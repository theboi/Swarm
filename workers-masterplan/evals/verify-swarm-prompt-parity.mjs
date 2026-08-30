import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(workspaceRoot, "..");
const skillPath = resolve(workspaceRoot, "blueprint-masterplan/SKILL.md");
const referencePath = resolve(
  workspaceRoot,
  "blueprint-masterplan/references/worker-prompt-templates.md",
);
const uiRequirementsTemplatePath = resolve(
  workspaceRoot,
  "blueprint-masterplan/references/ui-requirements-template.md",
);
const runtimeIsolationPath = resolve(
  workspaceRoot,
  "blueprint-masterplan/references/account-local-runtime-isolation.md",
);
const uiDesignPromptTemplatePath = resolve(
  workspaceRoot,
  "blueprint-masterplan/references/ui-design-worker-prompt-template.md",
);
const coordinatorTemplateDirectory = resolve(workspaceRoot, "swarm/templates");
const coordinatorRendererPath = resolve(
  workspaceRoot,
  "swarm/src/server/tasks/promptTemplates.ts",
);

const templateIds = ["planning", "execution", "ui"];
const phaseStopRules = {
  planning: "Do not implement product code, UI, migrations, or runtime behavior in this phase.",
  execution: "Execution ends only when fresh acceptance evidence, closed review, final status, and remote-reachability proof are present.",
  ui: "UI design stops after the accepted presentation handoff and UI requirements contract are integrated on `origin/main`.",
};
const lifecycleFacts = [
  "focused verification",
  "staging only owned paths",
  "commit directly to `main`",
  "fetch and merge newer `origin/main`",
  "rerun affected checks",
  "push, and prove remote reachability",
  "Never reset, clean, stash, rebase, force-push",
];
const uiChecklist = `**Mandatory pre-edit source-read checklist** — do not abbreviate:
- [ ] Completely read \`claude-design/codex/AGENTS.md\`.
- [ ] Completely read \`claude-design/codex/system-prompt.md\`.
- [ ] Completely read every relevant procedure under \`claude-design/codex/skills/\`.
- [ ] Completely read \`.agents/skills/better-ui/SKILL.md\`.`;
const uiRequirementsContractRules = [
  "fields, grouping, ordering, filters,",
  "search, pagination or cursor behavior",
  "confirmation requirement, idempotency",
  "success state, failure state, recovery action",
  "attention-required, partial-success, failed,",
  "navigation context switching",
  "file type and size limits",
  "keyboard operation, logical focus order and restoration",
  "at least one deterministic fixture/mock scenario for every required state",
  "fixture/mock data and no live",
  "missing-contract owner",
  "focused contract, browser, integration, or acceptance",
  "Decision owner | Blocking behavior | Affected plans",
  "Observable closure evidence",
  "Record `none` only after explicitly reconciling",
];
const fixtureReviewRuntimeRules = [
  "EDENMIND_AUTH_COOKIE_NAME=edenmind-auth-u<UID>",
  "NEXT_PUBLIC_EDENMIND_AUTH_COOKIE_NAME=edenmind-auth-u<UID>",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ACCOUNT_LOCAL_PUBLISHABLE_KEY>",
  "npm run dev -- --fixture --review-as <FIXTURE_IDENTITY>",
  "cookie-free browser context",
  "final review-readiness canary",
];
const reviewRuntimeLifetimeRules = [
  "independent of the worker's interactive command or chat session",
  "temporary yielded command session",
  "holder inspection and restart commands",
];
const coordinatorLaunchValues = {
  accountId: "bot3",
  blueprintPath: "docs/plans/edenmind_Implementation_Masterplan.md",
  chatName: "EdenMind W3 execution",
  coordinationRoot: "docs/workers/2026-08-26-edenmind",
  devServerCommand: "npm run dev -- --host 127.0.0.1",
  edenmindClonePath: "/Users/bot3/Dev/EdenMind",
  excludedSurfaces: "workers-masterplan/swarm/src/server/**",
  checkoutMode: "coordinator_managed_same_mac_clones",
  hardPrerequisites: "W1, W2",
  implementationModel: "Terra High",
  implementationPlanPath:
    "docs/superpowers/plans/2026-08-26-edenmind/2026-08-26-W3.md",
  masterplanPath: "docs/plans/edenmind_Implementation_Masterplan.md",
  mainMutationLock: "swarm-main-mutation-lock",
  mainPushQueue: "swarm-main-push-queue",
  ownedSurfaces: "workers-masterplan/swarm/src/client/**",
  plannedPrerequisites: "W2: specification docs/specs/w2.md implementation plan docs/plans/w2.md\nWD: UI requirements docs/design/requirements/wd.md presentation handoff docs/design/handoffs/wd.md",
  phase: "execution",
  phaseTerminalCondition: "Stop after the worker's phase handoff is integrated on origin/main.",
  planningGateCommit: "0123456789abcdef0123456789abcdef01234567",
  planningGatePath: "docs/workers/2026-08-26-edenmind/PLANNING_GATE.md",
  specificationPath:
    "docs/superpowers/specs/2026-08-26-edenmind/2026-08-26-W3-design.md",
  statusPath: "docs/workers/2026-08-26-edenmind/status/W3.md",
  taskId: "W3",
  taskTitle: "Coordinator launch contract",
  workerId: "W3",
  uiRequirementsPath: "docs/design/requirements/wd.md",
  uiHandoffPath: "docs/design/handoffs/wd.md",
};
const blueprintLaunchValues = Object.fromEntries(
  Object.entries(coordinatorLaunchValues).map(([key, value]) => [
    key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase(),
    value,
  ]),
);

function normalize(text) {
  return `${text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trimEnd()}\n`;
}

function renderBlueprintMasterplanPacket(source, sourceName) {
  return source.replace(/{{([A-Z_]+)}}/g, (match, field) => {
    const value = blueprintLaunchValues[field];
    if (!value) {
      throw new Error(`${sourceName} uses unresolved placeholder ${match}`);
    }
    return value;
  });
}

function resolveBlueprintEntryPoint(reference, templateId) {
  const escapedId = templateId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = reference.match(
    new RegExp("\\| " + escapedId + " \\| `([^`]+)` \\|"),
  );

  if (!match) {
    throw new Error(
      `Blueprint Masterplan has no canonical ${templateId} template entry point`,
    );
  }

  return resolve(repositoryRoot, match[1]);
}

const [
  skill,
  reference,
  uiRequirementsTemplate,
  runtimeIsolation,
  uiDesignPromptTemplate,
] = await Promise.all([
  readFile(skillPath, "utf8"),
  readFile(referencePath, "utf8"),
  readFile(uiRequirementsTemplatePath, "utf8"),
  readFile(runtimeIsolationPath, "utf8"),
  readFile(uiDesignPromptTemplatePath, "utf8"),
]);

if (!skill.includes("EdenMind swarm coordinator launch packets")) {
  throw new Error("Blueprint Masterplan skill does not expose the coordinator adapter");
}

if (!skill.includes("references/worker-prompt-templates.md#edenmind-swarm-coordinator-launch-packets")) {
  throw new Error("Blueprint Masterplan skill does not link its coordinator adapter");
}

if (!reference.includes("## EdenMind swarm coordinator launch packets")) {
  throw new Error("Worker prompt reference does not define the coordinator adapter");
}

for (const rule of uiRequirementsContractRules) {
  if (!uiRequirementsTemplate.includes(rule)) {
    throw new Error(`UI requirements template omits required contract rule: ${rule}`);
  }
}

const whitespaceNormalizedRuntimeIsolation = runtimeIsolation.replace(/\s+/g, " ");
for (const rule of fixtureReviewRuntimeRules) {
  if (!whitespaceNormalizedRuntimeIsolation.includes(rule)) {
    throw new Error(`Account-local runtime authority omits fixture-review rule: ${rule}`);
  }
}

for (const rule of reviewRuntimeLifetimeRules) {
  if (!whitespaceNormalizedRuntimeIsolation.includes(rule)) {
    throw new Error(`Account-local runtime authority omits process-lifetime rule: ${rule}`);
  }
}

for (const [sourceName, source] of [
  ["Blueprint Masterplan skill", skill],
  ["UI-design worker prompt template", uiDesignPromptTemplate],
]) {
  const whitespaceNormalizedSource = source.replace(/\s+/g, " ");
  for (const rule of [
    "--review-as",
    "EDENMIND_AUTH_COOKIE_NAME",
    "final cookie-free protected-route check",
  ]) {
    if (!whitespaceNormalizedSource.includes(rule)) {
      throw new Error(`${sourceName} omits fixture-review launch invariant: ${rule}`);
    }
  }
  if (!whitespaceNormalizedSource.includes(reviewRuntimeLifetimeRules[0])) {
    throw new Error(`${sourceName} omits the independent process-holder rule`);
  }
}

for (const placeholder of ["<UI_REQUIREMENTS_PATH>", "<DESIGN_HANDOFF_PATH>"]) {
  const references = reference.split(placeholder).length - 1;
  if (references < 3) {
    throw new Error(`Ordinary worker templates do not name ${placeholder} for live-wiring planning and execution`);
  }
}

const { renderWorkerPrompt } = await import(pathToFileURL(coordinatorRendererPath).href);

for (const templateId of templateIds) {
  const coordinatorPath = resolve(coordinatorTemplateDirectory, `${templateId}.md`);
  const blueprintPath = resolveBlueprintEntryPoint(reference, templateId);
  if (blueprintPath !== coordinatorPath) {
    throw new Error(
      `Blueprint Masterplan ${templateId} entry point does not resolve the canonical coordinator template`,
    );
  }
  const blueprintSource = await readFile(blueprintPath, "utf8");
  const coordinatorRender = Buffer.from(
    normalize(
      await renderWorkerPrompt(
        templateId,
        coordinatorLaunchValues,
        coordinatorTemplateDirectory,
      ),
    ),
    "utf8",
  );
  const blueprintRender = Buffer.from(
    normalize(
      renderBlueprintMasterplanPacket(
        blueprintSource,
        `Blueprint Masterplan ${templateId} template`,
      ),
    ),
    "utf8",
  );

  if (Buffer.compare(coordinatorRender, blueprintRender) !== 0) {
    throw new Error(
      `${templateId} render differs between coordinator and Blueprint Masterplan entry points`,
    );
  }

  const renderedPacket = coordinatorRender.toString("utf8");
  const whitespaceNormalizedPacket = renderedPacket.replace(/\s+/g, " ");
  if (!renderedPacket.includes(coordinatorLaunchValues.phaseTerminalCondition)) {
    throw new Error(`${templateId} does not render the required phase terminal condition`);
  }
  for (const field of ["checkoutMode", "mainMutationLock", "mainPushQueue"]) {
    if (!renderedPacket.includes(coordinatorLaunchValues[field])) {
      throw new Error(`${templateId} does not render the required ${field} launch slot`);
    }
  }
  if (!whitespaceNormalizedPacket.includes("fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability")) {
    throw new Error(`${templateId} does not require post-reconciliation verification`);
  }
  for (const fact of lifecycleFacts) {
    if (!whitespaceNormalizedPacket.includes(fact)) {
      throw new Error(`${templateId} does not retain the required lifecycle fact: ${fact}`);
    }
  }
  if (!whitespaceNormalizedPacket.includes(phaseStopRules[templateId])) {
    throw new Error(`${templateId} does not retain its phase-specific stopping rule`);
  }
  if (!whitespaceNormalizedPacket.includes("In `coordinator_managed_same_mac_clones` mode, acquire the named mutation lock") || !whitespaceNormalizedPacket.includes("In `independent_main_clone` mode, do not impose a global edit lock")) {
    throw new Error(`${templateId} does not distinguish serialized same-Mac clones from independent clones`);
  }
  const checklistCount = renderedPacket.split(uiChecklist).length - 1;
  if (templateId === "ui" && checklistCount !== 1) {
    throw new Error("ui must render exactly one mandatory pre-edit source-read checklist");
  }
  if (templateId !== "ui" && checklistCount !== 0) {
    throw new Error(`${templateId} must not render the UI-design source-read checklist`);
  }
  if (templateId === "ui") {
    for (const expected of [
      coordinatorLaunchValues.uiRequirementsPath,
      coordinatorLaunchValues.uiHandoffPath,
      "fixture/mock-backed state",
      "Do not add or change live wiring",
      "--review-as",
      "EDENMIND_AUTH_COOKIE_NAME",
      "final cookie-free protected-route check",
      reviewRuntimeLifetimeRules[0],
    ]) {
      if (!whitespaceNormalizedPacket.includes(expected)) throw new Error(`ui does not render required two-pass UI contract: ${expected}`);
    }
    if (!renderedPacket.includes("This UI design does not authorize ordinary execution.")) throw new Error("ui authorizes ordinary execution");
  }
  if (templateId === "planning") {
    for (const expected of [coordinatorLaunchValues.plannedPrerequisites, coordinatorLaunchValues.uiRequirementsPath, coordinatorLaunchValues.uiHandoffPath]) {
      if (!renderedPacket.includes(expected)) throw new Error(`planning does not consume required two-pass input: ${expected}`);
    }
    if (!renderedPacket.includes("A planning handoff never authorizes ordinary execution")) throw new Error("planning authorizes ordinary execution");
  }
  if (templateId === "execution") {
    for (const expected of [coordinatorLaunchValues.planningGatePath, coordinatorLaunchValues.uiRequirementsPath, coordinatorLaunchValues.uiHandoffPath, "live wiring"]) {
      if (!renderedPacket.includes(expected)) throw new Error(`execution does not render required live-wiring input: ${expected}`);
    }
  }

  process.stdout.write(
    `PASS ${templateId}: normalized renders match byte-for-byte (${coordinatorRender.length} bytes)\n`,
  );
}

process.stdout.write("PASS swarm prompt parity: 3 canonical packets verified\n");
