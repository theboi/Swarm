import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

import { ACCOUNT_IDS, LOCAL_ACCOUNT_ID, type AccountId, type BotAccountId } from "../../shared/contracts.js";
import { runBotPtyCommand, type RunBotCommand } from "../git/commandRunner.js";
import { workspaceRoot } from "../codex/protocol.js";

const execFileAsync = promisify(execFile);
const accounts = new Set<AccountId>(ACCOUNT_IDS);

export interface LocalHandoffFile {
  filename: string;
  path: string;
}

export interface LocalHandoffCopyInput {
  sourceAccountId: AccountId;
  sourceThreadId: string;
  targetAccountId: AccountId;
  targetWorkspace: string;
  jsonl: Buffer;
}

export interface TargetOwnedCopyInput {
  account: BotAccountId;
  password: string;
  sourcePath: string;
  targetPath: string;
}

type TargetOwnedCopy = (input: TargetOwnedCopyInput) => Promise<void>;

export interface LocalJsonlHandoffTransportOptions {
  /** Coordinator-owned, Git-ignored root for short-lived handoff files. */
  stagingRoot: string;
  /** Required only when the local account's workspace is not its standard clone path. */
  localWorkspaceRoot?: string;
  passwords: Readonly<Partial<Record<BotAccountId, string | undefined>>>;
  /** Internal test seam; production uses workspaceRoot. */
  workspaceFor?: (account: AccountId) => string;
  /** Internal test seam; production invokes authenticated su through a PTY. */
  copyAsTarget?: TargetOwnedCopy;
  /** Internal test seam; production grants only the target account read access to staging. */
  grantTargetRead?: (account: BotAccountId, path: string) => Promise<void>;
}

function quote(value: string): string {
  if (!value || value.includes("\0")) throw new Error("LOCAL_HANDOFF_INVALID: Handoff command value is invalid");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function contained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path !== "" && !path.startsWith("..") && !path.includes(`..${process.platform === "win32" ? "\\" : "/"}`);
}

function handoffFilename(sourceAccountId: AccountId, sourceThreadId: string): string {
  if (!sourceThreadId || sourceThreadId.includes("\0")) throw new Error("LOCAL_HANDOFF_INVALID: Source thread identifier is invalid");
  const suffix = createHash("sha256").update(`${sourceAccountId}\u0000${sourceThreadId}`).digest("hex").slice(0, 12);
  return `swarm-handoff-${sourceAccountId}-${suffix}.jsonl`;
}

async function grantTargetRead(account: BotAccountId, path: string): Promise<void> {
  // The file remains mode 0600; this transient macOS ACL permits only the
  // authenticated target account to read it during its own install command.
  await execFileAsync("/bin/chmod", ["+a", `${account} allow read`, path]);
}

function targetCopyCommand(sourcePath: string, targetPath: string): string {
  return `${quote("/usr/bin/install")} -m 600 ${quote(sourcePath)} ${quote(targetPath)}`;
}

async function defaultCopyAsTarget(input: TargetOwnedCopyInput, runBotCommand: RunBotCommand): Promise<void> {
  const exitCode = await runBotCommand(input.account, input.password, targetCopyCommand(input.sourcePath, input.targetPath));
  if (exitCode !== 0) throw new Error("target install exited unsuccessfully");
}

/** Copies rollout bytes locally; only the target account creates its final handoff file. */
export class LocalJsonlHandoffTransport {
  private readonly copyAsTarget: TargetOwnedCopy;
  private readonly workspaceFor: (account: AccountId) => string;
  private readonly grantTargetRead: (account: BotAccountId, path: string) => Promise<void>;

  constructor(private readonly options: LocalJsonlHandoffTransportOptions, runBotCommand: RunBotCommand = runBotPtyCommand) {
    this.workspaceFor = options.workspaceFor ?? ((account) => workspaceRoot(account, options.localWorkspaceRoot));
    this.copyAsTarget = options.copyAsTarget ?? ((input) => defaultCopyAsTarget(input, runBotCommand));
    this.grantTargetRead = options.grantTargetRead ?? grantTargetRead;
  }

  async copyJsonl(input: LocalHandoffCopyInput): Promise<LocalHandoffFile> {
    const { filename, targetPath } = this.validate(input);
    const stagingRoot = resolve(this.options.stagingRoot);
    await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
    await chmod(stagingRoot, 0o700);
    const stageDirectory = await mkdtemp(resolve(stagingRoot, "handoff-"));
    if (!contained(stagingRoot, stageDirectory)) {
      await rm(stageDirectory, { recursive: true, force: true });
      throw new Error("LOCAL_HANDOFF_INVALID: Handoff staging path is outside its coordinator workspace");
    }
    const stagingPath = resolve(stageDirectory, filename);
    try {
      await writeFile(stagingPath, input.jsonl, { mode: 0o600, flag: "wx" });
      await chmod(stagingPath, 0o600);
      if (input.targetAccountId === LOCAL_ACCOUNT_ID) {
        await copyFile(stagingPath, targetPath, 0);
        await chmod(targetPath, 0o600);
      } else {
        const password = this.options.passwords[input.targetAccountId];
        if (!password) throw new Error("LOCAL_HANDOFF_COPY_FAILED: Target account credentials are unavailable for the local handoff copy");
        await this.grantTargetRead(input.targetAccountId, stagingPath);
        await this.copyAsTarget({ account: input.targetAccountId, password, sourcePath: stagingPath, targetPath });
      }
      return { filename, path: targetPath };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("LOCAL_HANDOFF_")) throw error;
      throw new Error("LOCAL_HANDOFF_COPY_FAILED: Swarm could not copy the handoff rollout into the target account workspace", { cause: error });
    } finally {
      await rm(stageDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private validate(input: LocalHandoffCopyInput): { filename: string; targetPath: string } {
    if (!accounts.has(input.sourceAccountId) || !accounts.has(input.targetAccountId)) throw new Error("LOCAL_HANDOFF_INVALID: Only allowlisted Swarm accounts may transfer a handoff");
    if (!Buffer.isBuffer(input.jsonl)) throw new Error("LOCAL_HANDOFF_INVALID: Handoff rollout must be local bytes");
    const expectedWorkspace = resolve(this.workspaceFor(input.targetAccountId));
    const suppliedWorkspace = resolve(input.targetWorkspace);
    if (suppliedWorkspace !== expectedWorkspace) throw new Error("LOCAL_HANDOFF_INVALID: Target handoff workspace is outside the account's EdenMind clone");
    const stagingRoot = resolve(this.options.stagingRoot);
    const expectedStagingRoot = resolve(this.workspaceFor(LOCAL_ACCOUNT_ID), ".data", "handoffs");
    if (stagingRoot !== expectedStagingRoot && !this.options.workspaceFor) throw new Error("LOCAL_HANDOFF_INVALID: Handoff staging root is outside the coordinator workspace");
    const filename = handoffFilename(input.sourceAccountId, input.sourceThreadId);
    const targetPath = resolve(expectedWorkspace, filename);
    if (!contained(expectedWorkspace, targetPath)) throw new Error("LOCAL_HANDOFF_INVALID: Target handoff path is outside the account workspace");
    return { filename, targetPath };
  }
}
