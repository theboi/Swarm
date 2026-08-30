import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { ReadinessEvidence, TaskManifest, TaskManifestTask, TaskReadiness } from "../../shared/contracts.js";

const execFile = promisify(execFileCallback);
const SHA = /\b[0-9a-f]{6,64}\b/i;
const SHA_GLOBAL = /\b[0-9a-f]{6,64}\b/gi;

interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

function markdownCells(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return undefined;
  const body = trimmed.endsWith("|") ? trimmed.slice(1, -1) : trimmed.slice(1);
  return body.split("|").map((cell) => cell.trim());
}

function isMarkdownSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function markdownTables(text: string): MarkdownTable[] {
  const lines = text.split("\n");
  const tables: MarkdownTable[] = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const headers = markdownCells(lines[index] ?? "");
    const separator = markdownCells(lines[index + 1] ?? "");
    if (!headers || !separator || headers.length !== separator.length || !isMarkdownSeparator(separator)) continue;
    const rows: string[][] = [];
    let rowIndex = index + 2;
    while (rowIndex < lines.length) {
      const row = markdownCells(lines[rowIndex] ?? "");
      if (!row || row.length !== headers.length || isMarkdownSeparator(row)) break;
      rows.push(row);
      rowIndex += 1;
    }
    tables.push({ headers, rows });
    index = rowIndex - 1;
  }
  return tables;
}

function normalizeLabel(value: string): string {
  return value
    .replace(/[`*_]/g, "")
    .replace(/&nbsp;/gi, " ")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function plainCell(value: string): string {
  return value.replace(/[`*_]/g, "").trim();
}

function labelledValues(text: string | undefined): Array<{ label: string; value: string }> {
  if (!text) return [];
  const values: Array<{ label: string; value: string }> = [];
  for (const line of text.split("\n")) {
    const cells = markdownCells(line);
    if (cells && cells.length === 2 && !isMarkdownSeparator(cells)) {
      values.push({ label: normalizeLabel(cells[0] ?? ""), value: cells[1] ?? "" });
      continue;
    }
    const paragraph = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?([^:|]+?)(?:\*\*)?\s*:\s*(.+?)\s*$/);
    if (paragraph) values.push({ label: normalizeLabel(paragraph[1] ?? ""), value: paragraph[2] ?? "" });
  }
  return values;
}

function commitsFrom(value: string): string[] {
  return [...value.matchAll(SHA_GLOBAL)].map((match) => match[0].toLowerCase());
}

function uniqueCommitFromLabel(text: string | undefined, matchesLabel: (label: string) => boolean): string | undefined {
  const matchingValues = labelledValues(text).filter(({ label }) => matchesLabel(label));
  if (matchingValues.length !== 1) return undefined;
  const commits = commitsFrom(matchingValues[0]?.value ?? "");
  return commits.length === 1 ? commits[0] : undefined;
}

export interface BlueprintEvidence {
  code?: "MASTERPLAN_NOT_READY";
  remoteCommit?: string;
  /** Remote-head commits referenced by evidence and verified as integrated ancestors. */
  integratedCommits?: ReadonlySet<string>;
  records: Map<string, string>;
  missingPaths: Set<string>;
}

export interface EvidenceSource {
  fetch(): Promise<string | void>;
  revParse?(): Promise<string>;
  readRemote(path: string, commit: string): Promise<string | undefined>;
  isAncestor?(commit: string, remoteCommit: string): Promise<boolean>;
}

function remoteCommitFrom(text: string | undefined): string | undefined {
  return uniqueCommitFromLabel(text, (label) => label === "remotecommit"
    || label.startsWith("latest integrated origin main commit")
    || label.startsWith("latest origin main reconciled")
    || label === "authorized origin main commit"
    || label === "latest proven integration head before this status edit");
}

function acceptedAppStateCommitFrom(text: string | undefined): string | undefined {
  return uniqueCommitFromLabel(text, (label) => label === "accepted app state commit");
}

function authorizedGateCommitFrom(text: string | undefined): string | undefined {
  return uniqueCommitFromLabel(text, (label) => label === "authorized origin main commit");
}

function hasBlueprintIdentity(text: string | undefined, blueprintId: string): boolean {
  if (!text) return false;
  const escaped = blueprintId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?:Blueprint:\\s*" + escaped + "\\b|\\|\\s*Blueprint ID\\s*\\|\\s*`" + escaped + "`)", "i").test(text)
    && /origin\/main/i.test(text);
}

function allReferencedPaths(manifest: TaskManifest): string[] {
  return [manifest.masterplanPath, ...manifest.tasks.flatMap((task) => [task.statusPath, task.specificationPath, task.implementationPlanPath, task.uiRequirementsPath, task.uiHandoffPath])]
    .filter((path): path is string => Boolean(path));
}

export async function loadBlueprintEvidence(manifest: TaskManifest, source?: EvidenceSource): Promise<BlueprintEvidence> {
  if (!manifest.masterplanPath.trim()) return { code: "MASTERPLAN_NOT_READY", records: new Map(), missingPaths: new Set() };
  const gitSource: EvidenceSource = source ?? {
    async fetch() { await execFile("git", ["fetch", "origin", "main"]); },
    async revParse() { const { stdout } = await execFile("git", ["rev-parse", "origin/main"]); return stdout.trim(); },
    async readRemote(path, commit) { try { const { stdout } = await execFile("git", ["show", `${commit}:${path}`]); return stdout; } catch { return undefined; } },
    async isAncestor(commit, remoteCommit) { try { await execFile("git", ["merge-base", "--is-ancestor", commit, remoteCommit]); return true; } catch { return false; } },
  };

  const fetchResult = await gitSource.fetch();
  const remoteCommit = (gitSource.revParse ? await gitSource.revParse() : fetchResult)?.trim().toLowerCase();
  if (!remoteCommit || !SHA.test(remoteCommit)) return { code: "MASTERPLAN_NOT_READY", records: new Map(), missingPaths: new Set() };

  const records = new Map<string, string>();
  const missingPaths = new Set<string>();
  await Promise.all(allReferencedPaths(manifest).map(async (path) => {
    const content = await gitSource.readRemote(path, remoteCommit);
    if (content === undefined) missingPaths.add(path);
    else records.set(path, content);
  }));
  const integratedCommits = new Set<string>([remoteCommit]);
  const gatePaths = new Set(manifest.tasks.filter((task) => task.kind === "gate").map((task) => task.statusPath).filter((path): path is string => Boolean(path)));
  const citedCommits = new Set<string>();
  for (const [path, record] of records) {
    const statusCommit = remoteCommitFrom(record);
    const acceptedAppCommit = acceptedAppStateCommitFrom(record);
    if (statusCommit) citedCommits.add(statusCommit);
    if (acceptedAppCommit) citedCommits.add(acceptedAppCommit);
    if (gatePaths.has(path)) commitsFrom(record).forEach((commit) => citedCommits.add(commit));
  }
  await Promise.all([...citedCommits].map(async (commit) => {
    if (commit === remoteCommit || await gitSource.isAncestor?.(commit, remoteCommit)) integratedCommits.add(commit);
  }));
  if (!hasBlueprintIdentity(records.get(manifest.masterplanPath), manifest.blueprintId)) {
    return { code: "MASTERPLAN_NOT_READY", remoteCommit, integratedCommits, records, missingPaths };
  }
  return { remoteCommit, integratedCommits, records, missingPaths };
}

function evidence(code: string, satisfied: boolean, path?: string, commit?: string): ReadinessEvidence {
  return { code, satisfied, path, commit };
}

function terminalStateValue(value: string): boolean {
  const normalized = plainCell(value).toLowerCase();
  if (/\bincomplete\b|\bnot\s+(?:complete|completed|passed|integrated)\b/.test(normalized)) return false;
  if (/^(?:approval\s+)?pending\b|\bplanning[- ](?:blocked|in progress)\b|\bnot ready\b|\bunstarted\b|^open\b|^reopened\b/.test(normalized)) return false;
  return /\bcomplete(?:d)?\b|\bpassed\b|\bplanning[- ]handoff[- ]integrated\b|\b(?:complete|amended|worker-authored planning) handoff integrated\b/.test(normalized);
}

function statusIsRemoteTerminal(text: string | undefined, remoteCommit: string | undefined, integratedCommits?: ReadonlySet<string>): boolean {
  const committed = remoteCommitFrom(text);
  const stateValues = labelledValues(text)
    .filter(({ label }) => label === "state" || label === "status" || label === "gate state" || label === "worker planning state")
    .map(({ value }) => value);
  return Boolean(text
    && remoteCommit
    && committed
    && (integratedCommits?.has(committed) ?? committed === remoteCommit)
    && stateValues.some(terminalStateValue));
}

function planningArtifactsAreRemote(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.specificationPath && task.implementationPlanPath
    && source.records.has(task.specificationPath)
    && source.records.has(task.implementationPlanPath));
}

function planningEvidenceIsComplete(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.statusPath
    && statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits)
    && planningArtifactsAreRemote(task, source));
}

const NEGATIVE_EVIDENCE = /\b(?:pending|unapproved|unreconciled|incomplete|rejected|denied|declined|failed|false|missing|absent|open|reopened|blocked|provisional|draft|tbd|revoked|in progress|not applicable|not\s+(?:approved|accepted|complete|completed|passed|integrated|reconciled))\b/i;

function positiveEvidence(value: string, positive: RegExp): boolean {
  return !NEGATIVE_EVIDENCE.test(plainCell(value)) && positive.test(plainCell(value));
}

function completedEvidence(value: string, subject: RegExp): boolean {
  return positiveEvidence(value, subject)
    && positiveEvidence(value, /\b(?:complete|completed|passed|reconciled|integrated)\b/i);
}

function evidenceFragments(text: string | undefined): string[] {
  if (!text) return [];
  const fragments: string[] = [];
  for (const table of markdownTables(text)) {
    for (const row of table.rows) fragments.push(row.join(" | "));
  }
  for (const line of text.split("\n")) {
    if (!markdownCells(line) && line.trim()) fragments.push(line.trim());
  }
  return fragments;
}

function planningStatusIsApproved(text: string | undefined): boolean {
  if (!text) return false;
  const approvalValues = labelledValues(text)
    .filter(({ label }) => label.includes("approval"))
    .map(({ value }) => value);
  if (approvalValues.some((value) => NEGATIVE_EVIDENCE.test(plainCell(value)))) return false;
  if (approvalValues.some((value) => positiveEvidence(value, /\b(?:approved|accepted)\b/i))) return true;
  return labelledValues(text)
    .filter(({ label }) => label === "worker planning state")
    .some(({ value }) => {
      const normalized = plainCell(value);
      return !/\b(?:unapproved|not approved|approval\s+(?:is\s+)?pending|awaiting approval|approval\s+(?:rejected|denied|declined))\b/i.test(normalized)
        && /\b(?:product owner approved|approved specification|specification approved|approved planning|planning approved)\b/i.test(normalized);
    });
}

function planningStatusHasAuthorityEvidence(text: string | undefined): boolean {
  const authority = /\b(?:authority[- ](?:sync|synchronization|synchronised|synchronized)|no[- ]impact)\b/i;
  return evidenceFragments(text).some((fragment) => fragment
    .split(";")
    .some((clause) => completedEvidence(clause, authority)));
}

function approvedPlanningEvidenceIsComplete(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  const status = task.statusPath ? source.records.get(task.statusPath) : undefined;
  return planningEvidenceIsComplete(task, source)
    && planningStatusIsApproved(status)
    && planningStatusHasAuthorityEvidence(status);
}

function uiArtifactsAreRemote(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  const handoff = task.uiHandoffPath ? source.records.get(task.uiHandoffPath) : undefined;
  const acceptedCommit = acceptedAppStateCommitFrom(handoff);
  const approvalValues = labelledValues(handoff)
    .filter(({ label }) => label === "product owner approval" || label === "user approval")
    .map(({ value }) => value);
  return Boolean(
    task.uiRequirementsPath
      && task.uiHandoffPath
      && source.records.has(task.uiRequirementsPath)
      && handoff
      && acceptedCommit
      && source.integratedCommits?.has(acceptedCommit)
      && approvalValues.length === 1
      && positiveEvidence(approvalValues[0] ?? "", /\b(?:accepted|approved)\b/i),
  );
}

function uiEvidenceIsComplete(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.statusPath
    && statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits)
    && uiArtifactsAreRemote(task, source));
}

function statusNeedsAttention(text: string | undefined): boolean {
  return Boolean(text && /(?:^|\n)\s*\|?\s*(?:status|state)\s*(?:\||:)\s*(?:review|attention(?:[_ -]required)?|awaiting(?:[_ -](?:approval|review))?|paused)\b/im.test(text));
}

type ReceiptColumns = Record<string, readonly string[]>;

interface ReceiptRow {
  cells: Record<string, string>;
  presentColumns: Set<string>;
}

const ORDINARY_RECEIPT_COLUMNS: ReceiptColumns = {
  worker: ["worker", "execution worker"],
  specification: ["manifest specification path", "specification and commit", "specification path", "specification"],
  plan: ["manifest implementation plan path", "implementation plan and commit", "implementation plan path", "implementation plan"],
  approval: ["approval", "approval evidence"],
  authority: ["authority sync no impact", "living authority synchronization", "authority synchronization", "authority sync"],
  reconciliation: ["cross plan reconciliation"],
};

const UI_RECEIPT_COLUMNS: ReceiptColumns = {
  worker: ["worker", "ui worker"],
  requirements: ["requirements path", "ui requirements", "ui requirements path"],
  handoff: ["presentation handoff path", "presentation handoff"],
  acceptedAppCommit: ["accepted app commit", "accepted app state commit"],
  approval: ["approval", "approval evidence"],
  liveReview: ["live review"],
  reconciliation: ["requirements to plan reconciliation"],
  transfer: ["transfer target", "mutable owner transfer", "mutable ownership transfer"],
  remoteCommit: ["remote commit", "integrated remote commit"],
};

function receiptRows(text: string, requiredColumns: ReceiptColumns, optionalColumns: ReceiptColumns = {}): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  for (const table of markdownTables(text)) {
    const normalizedHeaders = table.headers.map(normalizeLabel);
    const indexes = new Map<string, number>();
    let valid = true;
    for (const [column, aliases] of Object.entries(requiredColumns)) {
      const matches = normalizedHeaders.flatMap((header, index) => aliases.includes(header) ? [index] : []);
      if (matches.length !== 1) {
        valid = false;
        break;
      }
      indexes.set(column, matches[0] ?? -1);
    }
    if (!valid || new Set(indexes.values()).size !== indexes.size) continue;
    for (const [column, aliases] of Object.entries(optionalColumns)) {
      const matches = normalizedHeaders.flatMap((header, index) => aliases.includes(header) ? [index] : []);
      if (matches.length > 1) {
        valid = false;
        break;
      }
      if (matches.length === 1) indexes.set(column, matches[0] ?? -1);
    }
    if (!valid || new Set(indexes.values()).size !== indexes.size) continue;
    for (const row of table.rows) {
      const cells: Record<string, string> = {};
      for (const [column, index] of indexes) cells[column] = row[index] ?? "";
      rows.push({ cells, presentColumns: new Set(indexes.keys()) });
    }
  }
  return rows;
}

function rowForWorker(rows: ReceiptRow[], workerId: string): ReceiptRow | undefined {
  const matches = rows.filter((row) => plainCell(row.cells.worker ?? "") === workerId);
  return matches.length === 1 ? matches[0] : undefined;
}

function cellContainsPath(cell: string, path: string): boolean {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9._/-])${escaped}(?=$|[^A-Za-z0-9._/-])`).test(cell);
}

function integratedCommitFromCell(cell: string, source: BlueprintEvidence): string | undefined {
  const commits = commitsFrom(cell);
  if (commits.length !== 1) return undefined;
  return source.integratedCommits?.has(commits[0] ?? "") ? commits[0] : undefined;
}

function ordinaryReceiptRowIsComplete(task: TaskManifestTask, receipt: string, source: BlueprintEvidence): boolean {
  const row = rowForWorker(receiptRows(receipt, ORDINARY_RECEIPT_COLUMNS, { remoteCommit: ["remote commit", "integrated remote commit"] }), task.id);
  if (!row || !task.specificationPath || !task.implementationPlanPath) return false;
  if (!cellContainsPath(row.cells.specification ?? "", task.specificationPath)
    || !cellContainsPath(row.cells.plan ?? "", task.implementationPlanPath)
    || !positiveEvidence(row.cells.approval ?? "", /\b(?:approved|accepted)\b/i)
    || !completedEvidence(row.cells.authority ?? "", /\b(?:authority[- ](?:sync|synchronization|synchronised|synchronized)|no[- ]impact)\b/i)
    || !positiveEvidence(row.cells.reconciliation ?? "", /\b(?:reconciled|complete|completed|passed)\b/i)) return false;
  if (row.presentColumns.has("remoteCommit")) return Boolean(integratedCommitFromCell(row.cells.remoteCommit ?? "", source));
  return Boolean(integratedCommitFromCell(row.cells.specification ?? "", source)
    && integratedCommitFromCell(row.cells.plan ?? "", source));
}

function expectedUiTransferTarget(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>): string | undefined {
  const consumers = [...taskById.values()].filter((candidate) => candidate.kind === "planning" && candidate.dependsOn.includes(task.id));
  return consumers.length === 1 ? consumers[0]?.id : undefined;
}

function uiReceiptRowIsComplete(task: TaskManifestTask, receipt: string, source: BlueprintEvidence, taskById: Map<string, TaskManifestTask>): boolean {
  const row = rowForWorker(receiptRows(receipt, UI_RECEIPT_COLUMNS), task.id);
  const handoff = task.uiHandoffPath ? source.records.get(task.uiHandoffPath) : undefined;
  const acceptedHandoffCommit = acceptedAppStateCommitFrom(handoff);
  const acceptedReceiptCommit = integratedCommitFromCell(row?.cells.acceptedAppCommit ?? "", source);
  const transferTarget = expectedUiTransferTarget(task, taskById);
  return Boolean(row
    && task.uiRequirementsPath
    && task.uiHandoffPath
    && cellContainsPath(row.cells.requirements ?? "", task.uiRequirementsPath)
    && cellContainsPath(row.cells.handoff ?? "", task.uiHandoffPath)
    && acceptedHandoffCommit
    && acceptedReceiptCommit === acceptedHandoffCommit
    && positiveEvidence(row.cells.approval ?? "", /\b(?:approved|accepted)\b/i)
    && positiveEvidence(row.cells.liveReview ?? "", /\b(?:complete|completed|passed|accepted)\b/i)
    && positiveEvidence(row.cells.reconciliation ?? "", /\b(?:reconciled|complete|completed|passed)\b/i)
    && transferTarget
    && positiveEvidence(row.cells.transfer ?? "", new RegExp(`(?:^|[^A-Za-z0-9])${transferTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^A-Za-z0-9])`, "i"))
    && integratedCommitFromCell(row.cells.remoteCommit ?? "", source));
}

function gateStateIsPassed(text: string): boolean {
  const values = labelledValues(text).filter(({ label }) => label === "gate state").map(({ value }) => value);
  return values.length === 1 && positiveEvidence(values[0] ?? "", /\bpassed\b/i);
}

function gateEvidenceIsComplete(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): boolean {
  if (!task.statusPath) return false;
  const receipt = source.records.get(task.statusPath) ?? "";
  const authorizedCommit = authorizedGateCommitFrom(receipt);
  if (!source.remoteCommit
    || !gateStateIsPassed(receipt)
    || !authorizedCommit
    || !source.integratedCommits?.has(authorizedCommit)) return false;
  const ordinaryRowsComplete = [...taskById.values()].filter((candidate) => candidate.kind === "planning").every((planning) =>
    planningEvidenceIsComplete(planning, source)
      && ordinaryReceiptRowIsComplete(planning, receipt, source));
  const uiRowsComplete = [...taskById.values()].filter((candidate) => candidate.kind === "ui").every((ui) =>
    uiEvidenceIsComplete(ui, source)
      && uiReceiptRowIsComplete(ui, receipt, source, taskById));
  return ordinaryRowsComplete && uiRowsComplete;
}

function dependencyTerminal(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): { satisfied: boolean; mismatch: boolean } {
  let mismatch = false;
  const satisfied = task.dependsOn.every((id) => {
    const dependency = taskById.get(id);
    if (!dependency?.statusPath) return false;
    const status = source.records.get(dependency.statusPath);
    const committed = remoteCommitFrom(status);
    if (committed && !(source.integratedCommits?.has(committed) ?? committed === source.remoteCommit)) mismatch = true;
    return statusIsRemoteTerminal(status, source.remoteCommit, source.integratedCommits);
  });
  return { satisfied, mismatch };
}

function dependencyPlanningEvidence(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): { satisfied: boolean; mismatch: boolean } {
  let mismatch = false;
  const satisfied = task.dependsOn.every((id) => {
    const dependency = taskById.get(id);
    if (!dependency?.statusPath) return false;
    const status = source.records.get(dependency.statusPath);
    const committed = remoteCommitFrom(status);
    if (committed && !(source.integratedCommits?.has(committed) ?? committed === source.remoteCommit)) mismatch = true;
    if (dependency.kind === "planning") {
      return task.kind === "ui"
        ? approvedPlanningEvidenceIsComplete(dependency, source)
        : planningEvidenceIsComplete(dependency, source);
    }
    if (dependency.kind === "ui") return uiEvidenceIsComplete(dependency, source);
    if (dependency.kind === "gate") return gateEvidenceIsComplete(dependency, taskById, source);
    return statusIsRemoteTerminal(status, source.remoteCommit, source.integratedCommits);
  });
  return { satisfied, mismatch };
}

export function evaluateTaskReadiness(manifest: TaskManifest, source: BlueprintEvidence): TaskReadiness[] {
  if (source.code === "MASTERPLAN_NOT_READY") {
    return manifest.tasks.map((task) => ({ taskId: task.id, phase: task.kind, state: "blocked", evidence: [evidence("MASTERPLAN_NOT_READY", false)], blockingCodes: ["MASTERPLAN_NOT_READY"] }));
  }

  const taskById = new Map(manifest.tasks.map((task) => [task.id, task]));
  return manifest.tasks.map((task) => {
    const dependencies = task.kind === "execution"
      ? dependencyTerminal(task, taskById, source)
      : dependencyPlanningEvidence(task, taskById, source);
    const ownStatus = task.statusPath ? statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits) : false;
    const planningGate = task.kind === "execution"
      ? task.dependsOn.map((id) => taskById.get(id)).find((candidate): candidate is TaskManifestTask => candidate?.kind === "gate")
      : undefined;
    const gatePassed = task.kind !== "execution" || Boolean(planningGate && gateEvidenceIsComplete(planningGate, taskById, source));
    const planningGateCommit = planningGate ? authorizedGateCommitFrom(source.records.get(planningGate.statusPath ?? "")) : source.remoteCommit;
    const uiArtifacts = task.kind === "ui" ? uiArtifactsAreRemote(task, source) : true;
    const requiredPlanning = task.kind === "gate"
      ? gateEvidenceIsComplete(task, taskById, source)
      : task.kind === "planning" ? (ownStatus ? planningArtifactsAreRemote(task, source) : true)
        : task.kind === "ui" ? (ownStatus ? uiArtifacts : true) : true;
    const terminal = task.kind === "gate"
      ? gateEvidenceIsComplete(task, taskById, source)
      : task.kind === "ui" ? uiEvidenceIsComplete(task, source) : ownStatus;
    const ready = dependencies.satisfied && gatePassed && requiredPlanning;
    const blockingCodes = ready ? [] : [dependencies.mismatch ? "REMOTE_EVIDENCE_MISMATCH" : "TASK_NOT_READY"];
    const needsAttention = !terminal && ready && statusNeedsAttention(task.statusPath ? source.records.get(task.statusPath) : undefined);
    const planningArtifacts = task.kind === "planning" ? planningArtifactsAreRemote(task, source) : requiredPlanning;
    return {
      taskId: task.id,
      phase: task.kind,
      state: terminal && ready ? "complete" : needsAttention ? "attention_required" : ready ? "ready" : "blocked",
      evidence: [
        evidence("REMOTE_PREREQUISITES", dependencies.satisfied, undefined, source.remoteCommit),
        evidence("PLANNING_GATE", gatePassed, planningGate?.statusPath ?? task.statusPath, planningGateCommit),
        evidence("PLANNING_ARTIFACTS", planningArtifacts, task.specificationPath, source.remoteCommit),
        evidence("UI_ARTIFACTS", uiArtifacts, task.uiRequirementsPath, source.remoteCommit),
      ],
      blockingCodes,
    };
  });
}
