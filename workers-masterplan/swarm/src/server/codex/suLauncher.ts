import { createHash, randomBytes } from "node:crypto";
import type { AccountId } from "../../shared/contracts.js";

const ALLOWED_ACCOUNTS = new Set<AccountId>(["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"]);

export interface SpawnedChild {
  pid?: number;
  stdin?: { write(value: string): boolean };
  stdout?: { on(event: "data", listener: (chunk: Buffer | string) => void): unknown };
  stderr?: { on(event: "data", listener: (chunk: Buffer | string) => void): unknown };
  on(event: "exit", listener: (code: number | null, signal?: string | null) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
}

export interface PortLease {
  port: number;
  release(): Promise<void>;
}

export interface LaunchHandle {
  account: AccountId;
  endpoint: string;
  readonly capabilityToken: string;
  stop(): Promise<void>;
}

export interface SuLauncherDependencies {
  spawn(file: string, args: string[], options: { detached: true; stdio: ["pipe", "pipe", "pipe"] }): SpawnedChild;
  allocatePort(): Promise<PortLease>;
  pathExists(path: string): Promise<boolean>;
  waitForReady(endpoint: string, capabilityToken: string): Promise<void>;
  killProcessGroup(pid: number, signal: "SIGTERM" | "SIGKILL"): void;
  log(entry: Record<string, unknown>): void;
  startupTimeoutMs?: number;
}

export interface LaunchAccountOptions {
  account: AccountId;
  password: string;
  codexBin: string;
}

function posixQuote(value: string): string {
  if (!value || value.includes("\0")) throw new Error("Invalid launcher command value");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isPasswordPrompt(value: string): boolean {
  return /(?:^|\n|\r)\s*password\s*:\s*$/im.test(value) || /password\s*:/i.test(value);
}

/** PTY-backed, account-isolated app-server launcher. It never persists credentials or tokens. */
export class SuLauncher {
  private readonly active = new Set<LaunchHandle>();

  constructor(private readonly dependencies: SuLauncherDependencies) {}

  async launch(options: LaunchAccountOptions): Promise<LaunchHandle> {
    if (!ALLOWED_ACCOUNTS.has(options.account)) throw new Error("Only allowlisted bot1 through bot8 accounts may be launched");
    if (!options.password) throw new Error("ACCOUNT_AUTH_REQUIRED");
    if (!options.codexBin.startsWith("/")) throw new Error("Configured Codex binary must be an absolute path");
    const codexHome = `/Users/${options.account}/.codex`;
    if (!(await this.dependencies.pathExists(options.codexBin)) || !(await this.dependencies.pathExists(codexHome))) {
      throw new Error("ACCOUNT_AUTH_REQUIRED");
    }
    const lease = await this.dependencies.allocatePort();
    if (!Number.isInteger(lease.port) || lease.port < 1 || lease.port > 65535) {
      await lease.release();
      throw new Error("Launcher received an invalid allocated port");
    }

    let token: string | undefined = randomBytes(32).toString("base64url");
    const digest = createHash("sha256").update(token).digest("hex");
    const endpoint = `ws://127.0.0.1:${lease.port}`;
    const command = `${posixQuote(options.codexBin)} app-server --listen ws://127.0.0.1:${lease.port} --ws-auth capability-token --ws-token-sha256 ${digest}`;
    const child = this.dependencies.spawn(
      "/usr/bin/script",
      ["-q", "/dev/null", "/usr/bin/su", "-", options.account, "-c", command],
      { detached: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    if (!child.pid) {
      token = undefined;
      await lease.release();
      throw new Error("ACCOUNT_AUTH_REQUIRED");
    }

    let settled = false;
    let stopped = false;
    let prompted = false;
    let timer: NodeJS.Timeout | undefined;
    let resolveLaunch: (handle: LaunchHandle) => void;
    let rejectLaunch: (error: Error) => void;
    const result = new Promise<LaunchHandle>((resolve, reject) => { resolveLaunch = resolve; rejectLaunch = reject; });

    const release = async () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      token = undefined;
      await lease.release();
    };
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      if (!stopped && child.pid) {
        stopped = true;
        this.dependencies.killProcessGroup(-child.pid, "SIGTERM");
      }
      this.active.delete(handle);
      void release();
      this.dependencies.log({ component: "suLauncher", account: options.account, event: "app_server_launch_failed", outcome: "ACCOUNT_AUTH_REQUIRED", reason });
      rejectLaunch!(new Error("ACCOUNT_AUTH_REQUIRED"));
    };
    const stop = async () => {
      if (stopped) return;
      stopped = true;
      if (child.pid) this.dependencies.killProcessGroup(-child.pid, "SIGTERM");
      await release();
      this.active.delete(handle);
    };
    const handle: LaunchHandle = {
      account: options.account,
      endpoint,
      get capabilityToken() {
        if (!token) throw new Error("Capability token is no longer available");
        return token;
      },
      stop,
    };
    this.active.add(handle);

    child.on("exit", () => {
      if (!stopped) fail("child_exit");
      this.active.delete(handle);
    });
    child.on("error", () => fail("child_error"));
    child.stdout?.on("data", (chunk) => {
      if (prompted || settled || !isPasswordPrompt(String(chunk))) return;
      prompted = true;
      child.stdin?.write(`${options.password}\n`);
      const currentToken = token;
      if (!currentToken) return fail("missing_token");
      void this.dependencies.waitForReady(endpoint, currentToken).then(() => {
        if (settled || stopped) return;
        settled = true;
        if (timer) clearTimeout(timer);
        timer = undefined;
        this.dependencies.log({ component: "suLauncher", account: options.account, event: "app_server_ready", outcome: "ok" });
        resolveLaunch!(handle);
      }).catch(() => fail("readiness_failed"));
    });
    child.stderr?.on("data", () => this.dependencies.log({ component: "suLauncher", account: options.account, event: "pty_stderr", outcome: "redacted" }));
    timer = setTimeout(() => fail("startup_timeout"), this.dependencies.startupTimeoutMs ?? 30_000);
    timer.unref();
    return result;
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.active].map((handle) => handle.stop()));
  }
}
