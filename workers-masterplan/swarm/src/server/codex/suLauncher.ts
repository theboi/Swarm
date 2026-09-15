import { createHash, randomBytes } from "node:crypto";
import { isBotProfileAccountId, isMacosBotId, LOCAL_ACCOUNT_ID, type AccountId, type CodexAccountSlot, type MacosBotId } from "../../shared/contracts.js";
import { codexLoginCommand, tmuxAttachCommand, tmuxServerCommand } from "./terminalConsole.js";

export interface SpawnedPty {
  pid: number;
  write(value: string): void;
  kill(signal?: string): void;
  dispose(): void;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void };
}

export interface PortLease {
  port: number;
  release(): Promise<void>;
}

export interface LaunchHandle {
  account: AccountId;
  slot?: CodexAccountSlot;
  endpoint: string;
  readonly capabilityToken: string;
  stop(): Promise<void>;
}

export interface SuLauncherDependencies {
  spawnPty(file: string, args: string[], options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> }): SpawnedPty;
  allocatePort(): Promise<PortLease>;
  pathExists(path: string): Promise<boolean>;
  verifyCodexBinary(path: string): Promise<boolean>;
  waitForReady(endpoint: string, capabilityToken: string): Promise<void>;
  killProcessGroup(pid: number, signal: "SIGTERM" | "SIGKILL"): void;
  openTerminal(command: string): Promise<void>;
  log(entry: Record<string, unknown>): void;
  startupTimeoutMs?: number;
}

export interface LaunchAccountOptions {
  account?: AccountId;
  slot?: CodexAccountSlot;
  password?: string;
  codexBin: string;
}

interface LaunchTarget {
  account: AccountId;
  macosUser?: MacosBotId;
  codexHome: string;
  slot?: CodexAccountSlot;
}

function legacyCodexHome(macosUser: MacosBotId): string {
  return `/Users/${macosUser}/.codex`;
}

function launchTarget(options: LaunchAccountOptions): LaunchTarget {
  if (options.slot) {
    const slot = options.slot;
    if (options.account !== undefined && options.account !== slot.id) throw new Error("Profile slot does not match requested account");
    if (!isBotProfileAccountId(slot.id) || slot.id.split("/")[0] !== slot.macosUser || slot.accountNumber < 1) throw new Error("Only allowlisted Swarm accounts may be launched");
    return { account: slot.id, macosUser: slot.macosUser, codexHome: slot.codexHome, slot };
  }
  const account = options.account;
  if (account === LOCAL_ACCOUNT_ID) return { account, codexHome: process.env.CODEX_HOME ?? `/Users/${process.env.USER ?? "claudiothe"}/.codex` };
  if (!isMacosBotId(account)) throw new Error("Only allowlisted Swarm accounts may be launched");
  return { account, macosUser: account, codexHome: legacyCodexHome(account) };
}

function posixQuote(value: string): string {
  if (!value || value.includes("\0")) throw new Error("Invalid launcher command value");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isPasswordPrompt(value: string): boolean {
  return /(?:^|[\r\n])Password:\s*$/.test(value);
}

function ptyEnvironment(): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    LANG: process.env.LANG ?? "en_US.UTF-8",
    TERM: "xterm-256color",
  };
}

/** PTY-backed, account-isolated app-server launcher. It never persists credentials or tokens. */
export class SuLauncher {
  private readonly active = new Set<LaunchHandle>();

  constructor(private readonly dependencies: SuLauncherDependencies) {}

  async launch(options: LaunchAccountOptions): Promise<LaunchHandle> {
    const target = launchTarget(options);
    const isBot = target.macosUser !== undefined;
    let credential = options.password ?? "";
    if (isBot && !credential) throw new Error("ACCOUNT_AUTH_REQUIRED");
    if (!options.codexBin.startsWith("/")) throw new Error("Configured Codex binary must be an absolute path");
    const codexHome = target.codexHome;
    // Profile homes are deliberately private to their macOS bot (0700), so
    // the coordinator must not require its own process to traverse them.
    if (!(await this.dependencies.verifyCodexBinary(options.codexBin)) || (!target.slot && !(await this.dependencies.pathExists(codexHome)))) {
      throw new Error("ACCOUNT_AUTH_REQUIRED");
    }
    const lease = await this.dependencies.allocatePort();
    if (!Number.isInteger(lease.port) || lease.port < 1 || lease.port > 65535) {
      await lease.release();
      throw new Error("Launcher received an invalid allocated port");
    }

    let leaseReleased = false;
    const releaseLease = async () => {
      if (leaseReleased) return;
      leaseReleased = true;
      await lease.release();
    };
    let token: string | undefined = randomBytes(32).toString("base64url");
    const digest = createHash("sha256").update(token).digest("hex");
    const endpoint = `ws://127.0.0.1:${lease.port}`;
    const appServer = `/usr/bin/env CODEX_HOME=${posixQuote(codexHome)} ${posixQuote(options.codexBin)} app-server --listen ws://127.0.0.1:${lease.port} --ws-auth capability-token --ws-token-sha256 ${digest}`;
    const command = tmuxServerCommand(target.account, appServer);
    let child: SpawnedPty;
    try {
      // Codex owns this listener, so the short-lived reservation must be released
      // before its app-server command attempts to bind the selected port.
      await releaseLease();
      const ptyOptions = { name: "xterm-256color", cols: 120, rows: 40, cwd: process.cwd(), env: ptyEnvironment() };
      child = target.account === LOCAL_ACCOUNT_ID
        ? this.dependencies.spawnPty("/bin/zsh", ["-lc", command], ptyOptions)
        : this.dependencies.spawnPty("/usr/bin/su", ["-", target.macosUser!, "-c", command], ptyOptions);
    } catch {
      token = undefined;
      await releaseLease();
      throw new Error("ACCOUNT_AUTH_REQUIRED");
    }

    let settled = false;
    let prompted = false;
    let terminalTail = "";
    let startupTimer: NodeJS.Timeout | undefined;
    let retryTimer: NodeJS.Timeout | undefined;
    let dataSubscription: { dispose(): void } | undefined;
    let exitSubscription: { dispose(): void } | undefined;
    let cleaned = false;
    let resolveLaunch: (handle: LaunchHandle) => void;
    let rejectLaunch: (error: Error) => void;
    const result = new Promise<LaunchHandle>((resolve, reject) => { resolveLaunch = resolve; rejectLaunch = reject; });
    let handle: LaunchHandle;
    const cleanup = async (terminate: boolean) => {
      if (cleaned) return;
      cleaned = true;
      if (startupTimer) clearTimeout(startupTimer);
      if (retryTimer) clearTimeout(retryTimer);
      startupTimer = undefined;
      retryTimer = undefined;
      dataSubscription?.dispose();
      exitSubscription?.dispose();
      if (terminate && child.pid) {
        this.dependencies.killProcessGroup(-child.pid, "SIGTERM");
        try { child.kill(); } catch { /* process already exited */ }
      }
      try { child.dispose(); } catch { /* descriptor already closed */ }
      credential = "";
      token = undefined;
      this.active.delete(handle);
      await releaseLease();
    };
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      void cleanup(true);
      this.dependencies.log({ component: "suLauncher", account: target.account, event: "app_server_launch_failed", outcome: "ACCOUNT_AUTH_REQUIRED", reason });
      rejectLaunch!(new Error("ACCOUNT_AUTH_REQUIRED"));
    };
    const stop = async () => {
      if (!settled) {
        settled = true;
        await cleanup(true);
        rejectLaunch!(new Error("ACCOUNT_AUTH_REQUIRED"));
        return;
      }
      await cleanup(true);
    };
    handle = {
      account: target.account,
      ...(target.slot ? { slot: target.slot } : {}),
      endpoint,
      get capabilityToken() {
        if (!token) throw new Error("Capability token is no longer available");
        return token;
      },
      stop,
    };
    this.active.add(handle);

    exitSubscription = child.onExit(() => {
      if (!settled) {
        settled = true;
        this.dependencies.log({ component: "suLauncher", account: target.account, event: "app_server_launch_failed", outcome: "ACCOUNT_AUTH_REQUIRED", reason: "child_exit" });
        rejectLaunch!(new Error("ACCOUNT_AUTH_REQUIRED"));
      }
      void cleanup(false);
    });
    const waitForAppServer = (currentToken: string) => {
      void this.dependencies.waitForReady(endpoint, currentToken).then(() => {
        if (settled || cleaned) return;
        settled = true;
        if (startupTimer) clearTimeout(startupTimer);
        startupTimer = undefined;
        this.dependencies.log({ component: "suLauncher", account: target.account, event: "app_server_ready", outcome: "ok" });
        resolveLaunch!(handle);
      }).catch(() => {
        if (settled || cleaned) return;
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          waitForAppServer(currentToken);
        }, 100);
        retryTimer.unref();
      });
    };
    const receivePtyOutput = (chunk: string) => {
      if (prompted || settled) return;
      terminalTail = `${terminalTail}${String(chunk)}`.slice(-256);
      if (!isPasswordPrompt(terminalTail)) return;
      prompted = true;
      terminalTail = "";
      const password = credential;
      credential = "";
      if (!password) return fail("missing_password");
      child.write(`${password}\n`);
      const currentToken = token;
      if (!currentToken) return fail("missing_token");
      waitForAppServer(currentToken);
    };
    startupTimer = setTimeout(() => fail("startup_timeout"), this.dependencies.startupTimeoutMs ?? 30_000);
    startupTimer.unref();
    if (target.account === LOCAL_ACCOUNT_ID) {
      const currentToken = token;
      if (!currentToken) fail("missing_token");
      else waitForAppServer(currentToken);
    } else {
      dataSubscription = child.onData(receivePtyOutput);
    }
    return result;
  }

  async openTerminal(account: AccountId): Promise<void> {
    const handle = [...this.active].find((candidate) => candidate.account === account);
    if (!handle) throw new Error("ACCOUNT_OFFLINE");
    await this.dependencies.openTerminal(tmuxAttachCommand(handle.slot ?? account));
  }

  async openLoginTerminal(account: AccountId | CodexAccountSlot, codexBin: string): Promise<void> {
    if (typeof account === "object" ? !isBotProfileAccountId(account.id) : account !== LOCAL_ACCOUNT_ID && !isMacosBotId(account)) throw new Error("ACCOUNT_OFFLINE");
    await this.dependencies.openTerminal(codexLoginCommand(account, codexBin));
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.active].map((handle) => handle.stop()));
  }
}
