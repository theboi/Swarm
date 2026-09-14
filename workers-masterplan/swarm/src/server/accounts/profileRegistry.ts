import { chmod, lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, parse, resolve } from "node:path";

import {
  isBotProfileAccountId,
  isMacosBotId,
  MACOS_BOT_IDS,
  type BotProfileAccountId,
  type CodexAccountSlot,
  type MacosBotId,
} from "../../shared/contracts.js";
import { containsSecretLikeValue } from "../state/atomicStateStore.js";

export interface ProfileRegistryFile {
  schemaVersion: 1;
  profiles: CodexAccountSlot[];
}

export class ProfileRegistryError extends Error {
  readonly code = "PROFILE_REGISTRY_INVALID" as const;

  constructor(message: string) {
    super(`PROFILE_REGISTRY_INVALID: ${message}`);
  }
}

const FILE_KEYS = new Set(["schemaVersion", "profiles"]);
const PROFILE_KEYS = new Set(["id", "macosUser", "accountNumber", "codexHome", "workspaceRoot"]);

function fail(message: string): never {
  throw new ProfileRegistryError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cloneSlot(slot: CodexAccountSlot): CodexAccountSlot {
  return { ...slot };
}

function compareSlots(left: CodexAccountSlot, right: CodexAccountSlot): number {
  const bot = Number(left.macosUser.slice(3)) - Number(right.macosUser.slice(3));
  return bot || left.accountNumber - right.accountNumber;
}

function defaultSlot(macosUser: MacosBotId): CodexAccountSlot {
  return {
    id: `${macosUser}/acc1`,
    macosUser,
    accountNumber: 1,
    codexHome: `/Users/${macosUser}/.codex`,
    workspaceRoot: `/Users/${macosUser}/Dev/EdenMind`,
  };
}

function defaultRegistry(): ProfileRegistryFile {
  return { schemaVersion: 1, profiles: MACOS_BOT_IDS.map(defaultSlot) };
}

function isCanonicalAbsolutePath(value: unknown): value is string {
  return typeof value === "string" && isAbsolute(value) && value === normalize(value) && value !== parse(value).root;
}

function expectedManagedCodexHome(macosUser: MacosBotId, accountNumber: number): string {
  return `/Users/${macosUser}/.swarm/codex-profiles/acc${accountNumber}`;
}

function expectedManagedWorkspace(macosUser: MacosBotId, accountNumber: number): string {
  return `/Users/${macosUser}/Dev/EdenMind-acc${accountNumber}`;
}

function validateSlot(value: unknown): CodexAccountSlot {
  if (!isRecord(value) || containsSecretLikeValue(value)) fail("Profile records must be non-secret objects");
  for (const key of Object.keys(value)) if (!PROFILE_KEYS.has(key)) fail(`Unknown profile key: ${key}`);
  const accountNumber = value.accountNumber;
  if (!isBotProfileAccountId(value.id) || !isMacosBotId(value.macosUser) || typeof accountNumber !== "number" || !Number.isInteger(accountNumber) || accountNumber < 1
    || !isCanonicalAbsolutePath(value.codexHome) || !isCanonicalAbsolutePath(value.workspaceRoot)) fail("Invalid profile slot");

  const match = /^(bot[1-8])\/acc([1-9][0-9]*)$/.exec(value.id);
  if (!match || match[1] !== value.macosUser || Number(match[2]) !== accountNumber) fail("Profile ID does not match its owner or account number");

  const legacyCodexHome = `/Users/${value.macosUser}/.codex`;
  const legacyWorkspace = `/Users/${value.macosUser}/Dev/EdenMind`;
  const managedCodexHome = expectedManagedCodexHome(value.macosUser, accountNumber);
  const managedWorkspace = expectedManagedWorkspace(value.macosUser, accountNumber);
  const supportsLegacyPath = accountNumber === 1;
  if (value.codexHome !== managedCodexHome && (!supportsLegacyPath || value.codexHome !== legacyCodexHome)) fail("Profile Codex home is outside its approved root");
  if (value.workspaceRoot !== managedWorkspace && (!supportsLegacyPath || value.workspaceRoot !== legacyWorkspace)) fail("Profile workspace is outside its approved root");

  return {
    id: value.id,
    macosUser: value.macosUser,
    accountNumber,
    codexHome: value.codexHome,
    workspaceRoot: value.workspaceRoot,
  };
}

function validateRegistry(value: unknown): ProfileRegistryFile {
  if (!isRecord(value) || containsSecretLikeValue(value)) fail("Registry must be a non-secret object");
  for (const key of Object.keys(value)) if (!FILE_KEYS.has(key)) fail(`Unknown registry key: ${key}`);
  if (value.schemaVersion !== 1 || !Array.isArray(value.profiles)) fail("Unsupported registry schema");

  const profiles = value.profiles.map(validateSlot);
  const ids = new Set<string>();
  const codexHomes = new Set<string>();
  const workspaceRoots = new Set<string>();
  for (const slot of profiles) {
    if (ids.has(slot.id) || codexHomes.has(slot.codexHome) || workspaceRoots.has(slot.workspaceRoot)) fail("Profile registry has duplicate IDs or paths");
    ids.add(slot.id);
    codexHomes.add(slot.codexHome);
    workspaceRoots.add(slot.workspaceRoot);
  }
  for (const bot of MACOS_BOT_IDS) if (!ids.has(`${bot}/acc1`)) fail(`Missing required primary slot for ${bot}`);
  return { schemaVersion: 1, profiles: profiles.sort(compareSlots) };
}

async function assertNoSymlinkedRegistryParent(path: string): Promise<void> {
  const absoluteParent = resolve(dirname(path));
  const parsed = parse(absoluteParent);
  let current = parsed.root;
  for (const segment of absoluteParent.slice(parsed.root.length).split("/").filter(Boolean)) {
    current = join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) fail("Registry parent may not be a symbolic link");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

async function writeRegistry(path: string, value: ProfileRegistryFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await assertNoSymlinkedRegistryParent(path);
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
}

export class ProfileRegistry {
  private mutation = Promise.resolve();

  private constructor(
    private readonly path: string,
    private profiles: CodexAccountSlot[],
  ) {}

  static async load(path: string): Promise<ProfileRegistry> {
    await assertNoSymlinkedRegistryParent(path);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return new ProfileRegistry(path, defaultRegistry().profiles);
      fail("Registry JSON is unreadable");
    }
    return new ProfileRegistry(path, validateRegistry(parsed).profiles);
  }

  list(): CodexAccountSlot[] {
    return this.profiles.map(cloneSlot);
  }

  resolve(id: BotProfileAccountId): CodexAccountSlot | undefined {
    const slot = this.profiles.find((profile) => profile.id === id);
    return slot && cloneSlot(slot);
  }

  forBot(macosUser: MacosBotId): CodexAccountSlot[] {
    return this.profiles.filter((profile) => profile.macosUser === macosUser).map(cloneSlot);
  }

  nextId(macosUser: MacosBotId): BotProfileAccountId {
    const used = new Set(this.forBot(macosUser).map((profile) => profile.accountNumber));
    let accountNumber = 2;
    while (used.has(accountNumber)) accountNumber += 1;
    return `${macosUser}/acc${accountNumber}`;
  }

  async publish(slot: CodexAccountSlot): Promise<void> {
    await this.update((profiles) => {
      if (profiles.some((profile) => profile.id === slot.id)) fail(`Profile already exists: ${slot.id}`);
      return [...profiles, cloneSlot(slot)];
    });
  }

  async replace(slot: CodexAccountSlot): Promise<void> {
    await this.update((profiles) => {
      const index = profiles.findIndex((profile) => profile.id === slot.id);
      if (index < 0) fail(`Profile does not exist: ${slot.id}`);
      return profiles.map((profile, profileIndex) => profileIndex === index ? cloneSlot(slot) : profile);
    });
  }

  private async update(mutator: (profiles: CodexAccountSlot[]) => CodexAccountSlot[]): Promise<void> {
    const next = this.mutation.then(async () => {
      const candidate = validateRegistry({ schemaVersion: 1, profiles: mutator(this.list()) });
      await writeRegistry(this.path, candidate);
      this.profiles = candidate.profiles;
    });
    this.mutation = next.catch(() => undefined);
    await next;
  }
}
