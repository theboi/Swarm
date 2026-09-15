import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
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
  targetWorkspace: string;
  filename: string;
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
  /** Internal test seam; production grants only the target account the minimum ACL access to staging. */
  grantTargetAccess?: TargetAccessGrant;
  grantTargetStageAccess?: (account: BotAccountId, paths: StagingAccessPaths) => Promise<void>;
  revokeTargetAccess?: (account: BotAccountId, paths: StagingAccessPaths) => Promise<void>;
  /** Internal test seam for a persistent cleanup failure that cannot be created portably. */
  removeStageDirectory?: (path: string) => Promise<void>;
  /** Internal test seam for a destination replacement attempt between validation and creation. */
  beforeDestinationCreate?: (targetPath: string) => Promise<void>;
}

interface StagingAccessPaths {
  sharedDirectories: string[];
  directory: string;
  file: string;
}

type TargetAccessGrant = (account: BotAccountId, paths: StagingAccessPaths, onSharedDirectoryGranted: (directory: string) => void) => Promise<void>;

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
  return `swarm-handoff-${sourceAccountId}-${suffix}-${randomUUID()}.jsonl`;
}

async function grantTargetStageAccess(account: BotAccountId, paths: StagingAccessPaths): Promise<void> {
  await execFileAsync("/bin/chmod", ["+a", `${account} allow search`, paths.directory]);
  await execFileAsync("/bin/chmod", ["+a", `${account} allow read`, paths.file]);
}

async function grantTargetAccess(account: BotAccountId, paths: StagingAccessPaths, onSharedDirectoryGranted: (directory: string) => void): Promise<void> {
  // The file remains mode 0600. The target gets only directory traversal and
  // file read access long enough to run its authenticated install command.
  for (const directory of paths.sharedDirectories) {
    await execFileAsync("/bin/chmod", ["+a", `${account} allow search`, directory]);
    onSharedDirectoryGranted(directory);
  }
  await grantTargetStageAccess(account, paths);
}

async function revokeTargetAccess(account: BotAccountId, paths: StagingAccessPaths): Promise<void> {
  let rollbackFailure: unknown;
  for (const directory of [...paths.sharedDirectories].reverse()) {
    try {
      await execFileAsync("/bin/chmod", ["-a", `${account} allow search`, directory]);
    } catch (error) {
      rollbackFailure ??= error;
    }
  }
  if (rollbackFailure) throw new Error("Shared staging ACL revocation failed", { cause: rollbackFailure });
}

function targetCopyCommand(input: TargetOwnedCopyInput): string {
  return `${quote("/usr/bin/git")} -C ${quote(input.targetWorkspace)} check-ignore -q -- ${quote(input.filename)} && (umask 077; set -C; ${quote("/bin/cat")} ${quote(input.sourcePath)} > ${quote(input.targetPath)})`;
}

async function defaultCopyAsTarget(input: TargetOwnedCopyInput, runBotCommand: RunBotCommand): Promise<void> {
  const exitCode = await runBotCommand(input.account, input.password, targetCopyCommand(input));
  if (exitCode !== 0) throw new Error("target install exited unsuccessfully");
}

async function ensureIgnored(workspace: string, filename: string): Promise<void> {
  await execFileAsync("/usr/bin/git", ["-C", workspace, "check-ignore", "-q", "--", filename]);
}

async function destinationDoesNotExist(path: string): Promise<void> {
  try {
    const entry = await lstat(path);
    if (entry.isSymbolicLink()) throw new Error("LOCAL_HANDOFF_INVALID: Target handoff destination must not be a symbolic link");
    throw new Error("LOCAL_HANDOFF_INVALID: Target handoff destination already exists");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LOCAL_HANDOFF_")) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new Error("LOCAL_HANDOFF_INVALID: Target handoff destination cannot be safely inspected", { cause: error });
  }
}

function canonicalContained(root: string, target: string): boolean {
  return root === target || contained(root, target);
}

async function directoryBoundary(path: string, message: string, canonicalRoot?: string): Promise<string> {
  const entry = await lstat(path).catch((error) => { throw new Error(message, { cause: error }); });
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(message);
  const canonicalPath = await realpath(path).catch((error) => { throw new Error(message, { cause: error }); });
  if (canonicalRoot && !canonicalContained(canonicalRoot, canonicalPath)) throw new Error(message);
  return canonicalPath;
}

async function ensureStagingRoot(stagingRoot: string, localWorkspace: string): Promise<string> {
  const workspace = resolve(localWorkspace);
  const relativeStagingRoot = relative(workspace, stagingRoot);
  if (!relativeStagingRoot || relativeStagingRoot.startsWith("..") || relativeStagingRoot.includes(`..${sep}`)) throw new Error("LOCAL_HANDOFF_INVALID: Handoff staging root is outside the coordinator workspace");
  const canonicalWorkspace = await directoryBoundary(workspace, "LOCAL_HANDOFF_INVALID: Handoff coordinator workspace must be a real directory");
  let current = workspace;
  for (const component of relativeStagingRoot.split(sep)) {
    current = resolve(current, component);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) throw new Error("LOCAL_HANDOFF_INVALID: Handoff staging root must be a real coordinator directory");
      if (!entry.isDirectory()) throw new Error("Handoff staging initialization path is not a directory");
      await directoryBoundary(current, "LOCAL_HANDOFF_INVALID: Handoff staging root must be a real coordinator directory", canonicalWorkspace);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(current, { mode: 0o700 });
      await directoryBoundary(current, "LOCAL_HANDOFF_INVALID: Handoff staging root must be a real coordinator directory", canonicalWorkspace);
    }
  }
  return canonicalWorkspace;
}

type StagingLease = StagingAccessPaths & { account: BotAccountId };

/** Copies rollout bytes locally; only the target account creates its final handoff file. */
export class LocalJsonlHandoffTransport {
  private readonly copyAsTarget: TargetOwnedCopy;
  private readonly workspaceFor: (account: AccountId) => string;
  private readonly grantTargetAccess: TargetAccessGrant;
  private readonly grantTargetStageAccess: (account: BotAccountId, paths: StagingAccessPaths) => Promise<void>;
  private readonly revokeTargetAccess: (account: BotAccountId, paths: StagingAccessPaths) => Promise<void>;
  private readonly removeStageDirectory: (path: string) => Promise<void>;
  private readonly rootAccessCounts = new Map<BotAccountId, number>();
  private readonly targetAccessQueues = new Map<BotAccountId, Promise<void>>();

  constructor(private readonly options: LocalJsonlHandoffTransportOptions, runBotCommand: RunBotCommand = runBotPtyCommand) {
    this.workspaceFor = options.workspaceFor ?? ((account) => workspaceRoot(account, options.localWorkspaceRoot));
    this.copyAsTarget = options.copyAsTarget ?? ((input) => defaultCopyAsTarget(input, runBotCommand));
    this.grantTargetAccess = options.grantTargetAccess ?? grantTargetAccess;
    this.grantTargetStageAccess = options.grantTargetStageAccess ?? grantTargetStageAccess;
    this.revokeTargetAccess = options.revokeTargetAccess ?? revokeTargetAccess;
    this.removeStageDirectory = options.removeStageDirectory ?? ((path) => rm(path, { recursive: true, force: true }));
  }

  async copyJsonl(input: LocalHandoffCopyInput): Promise<LocalHandoffFile> {
    const { filename, targetPath } = await this.validate(input);
    const stagingRoot = resolve(this.options.stagingRoot);
    let stageDirectory: string | undefined;
    let lease: StagingLease | undefined;
    try {
      // The target clone must ignore the durable handoff before any rollout
      // bytes are staged, so an eventual checkpoint cannot add it to Git.
      await ensureIgnored(input.targetWorkspace, filename);
      const localWorkspace = resolve(this.workspaceFor(LOCAL_ACCOUNT_ID));
      const canonicalWorkspace = await ensureStagingRoot(stagingRoot, localWorkspace);
      await chmod(stagingRoot, 0o700);
      stageDirectory = await mkdtemp(resolve(stagingRoot, "handoff-"));
      if (!contained(stagingRoot, stageDirectory)) throw new Error("LOCAL_HANDOFF_INVALID: Handoff staging path is outside its coordinator workspace");
      await directoryBoundary(stageDirectory, "LOCAL_HANDOFF_INVALID: Handoff staging directory must not be a symbolic link", canonicalWorkspace);
      const stagingPath = resolve(stageDirectory, filename);
      await writeFile(stagingPath, input.jsonl, { mode: 0o600, flag: "wx" });
      await chmod(stagingPath, 0o600);
      await this.options.beforeDestinationCreate?.(targetPath);
      if (input.targetAccountId === LOCAL_ACCOUNT_ID) {
        await copyFile(stagingPath, targetPath, fileConstants.COPYFILE_EXCL);
      } else {
        const password = this.options.passwords[input.targetAccountId];
        if (!password) throw new Error("LOCAL_HANDOFF_COPY_FAILED: Target account credentials are unavailable for the local handoff copy");
        lease = await this.acquireStagingLease(input.targetAccountId, { sharedDirectories: [dirname(stagingRoot), stagingRoot], directory: stageDirectory, file: stagingPath });
        await this.copyAsTarget({ account: input.targetAccountId, password, sourcePath: stagingPath, targetPath, targetWorkspace: input.targetWorkspace, filename });
      }
      return { filename, path: targetPath };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("LOCAL_HANDOFF_")) throw error;
      throw new Error("LOCAL_HANDOFF_COPY_FAILED: Swarm could not copy the handoff rollout into the target account workspace", { cause: error });
    } finally {
      if (stageDirectory) await this.cleanup(stageDirectory, stagingRoot, lease);
    }
  }

  private async validate(input: LocalHandoffCopyInput): Promise<{ filename: string; targetPath: string }> {
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
    await directoryBoundary(expectedWorkspace, "LOCAL_HANDOFF_INVALID: Target handoff workspace must be a real account workspace");
    await destinationDoesNotExist(targetPath);
    return { filename, targetPath };
  }

  private async withTargetAccessLock<T>(account: BotAccountId, operation: () => Promise<T>): Promise<T> {
    const previous = this.targetAccessQueues.get(account) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const complete = new Promise<void>((resolveComplete) => { release = resolveComplete; });
    const current = previous.then(() => complete);
    this.targetAccessQueues.set(account, current);
    await previous;
    try {
      return await operation();
    } finally {
      release?.();
      if (this.targetAccessQueues.get(account) === current) this.targetAccessQueues.delete(account);
    }
  }

  private async acquireStagingLease(account: BotAccountId, paths: StagingAccessPaths): Promise<StagingLease> {
    return this.withTargetAccessLock(account, async () => {
      const count = this.rootAccessCounts.get(account) ?? 0;
      const grantedSharedDirectories: string[] = [];
      try {
        if (count === 0) {
          await this.grantTargetAccess(account, paths, (directory) => {
            if (paths.sharedDirectories.includes(directory) && !grantedSharedDirectories.includes(directory)) grantedSharedDirectories.push(directory);
          });
        }
        else await this.grantTargetStageAccess(account, paths);
      } catch (error) {
        if (count === 0 && grantedSharedDirectories.length > 0) {
          try {
            await this.revokeTargetAccess(account, { ...paths, sharedDirectories: grantedSharedDirectories });
          } catch (rollbackError) {
            throw new Error("LOCAL_HANDOFF_CLEANUP_FAILED: Swarm could not revoke shared staging access after a failed ACL grant", { cause: rollbackError });
          }
        }
        throw error;
      }
      this.rootAccessCounts.set(account, count + 1);
      return { account, ...paths };
    });
  }

  private async releaseStagingLease(lease: StagingLease): Promise<void> {
    await this.withTargetAccessLock(lease.account, async () => {
      const count = (this.rootAccessCounts.get(lease.account) ?? 1) - 1;
      if (count <= 0) {
        this.rootAccessCounts.delete(lease.account);
        await this.revokeTargetAccess(lease.account, lease);
      } else this.rootAccessCounts.set(lease.account, count);
    });
  }

  private async cleanup(stageDirectory: string, stagingRoot: string, lease: StagingLease | undefined): Promise<void> {
    let cleanupFailure: unknown;
    try {
      await this.removeStageDirectory(stageDirectory);
    } catch (error) {
      try {
        await chmod(stagingRoot, 0o700);
        await this.removeStageDirectory(stageDirectory);
      } catch (recoveryError) {
        cleanupFailure = recoveryError;
      }
    }
    if (lease) {
      try {
        await this.releaseStagingLease(lease);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    if (cleanupFailure) throw new Error("LOCAL_HANDOFF_CLEANUP_FAILED: Swarm could not remove local handoff staging data after bounded recovery", { cause: cleanupFailure });
  }
}
