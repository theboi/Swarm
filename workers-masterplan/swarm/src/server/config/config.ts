import { stat } from "node:fs/promises";
import { userInfo } from "node:os";
import { resolve } from "node:path";
import type { BotAccountId } from "../../shared/contracts.js";

export interface SwarmConfig {
  host: string;
  port: number;
  terminalPort: number;
  timezone: string;
  loginEmail: string;
  loginPasswordHash: string;
  totpSecret: string;
  sessionSecret: string;
  codexBin: string;
  trustManagedProxy: boolean;
  masterplanPath: string | undefined;
  coordinationRoot: string | undefined;
  ngrok: { enabled: boolean; bin: string; authtoken: string | undefined; url: string | undefined; start: string; stop: string };
  localAccount: string;
  accountPasswords: Record<BotAccountId, string | undefined>;
  publicConfig(): string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment value ${name}`);
  return value;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true";
}

export function swarmUserPassword(env: NodeJS.ProcessEnv, index: number): string | undefined {
  const name = `SWARM_USER${index}`;
  const value = env[name]?.trim();
  if (!value) return undefined;
  const prefix = `bot${index}:`;
  if (!value.startsWith(prefix) || value.length === prefix.length) throw new Error(`${name} must start with ${prefix}password`);
  return value.slice(prefix.length);
}

export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<SwarmConfig> {
  if (env.SWARM_ENV_FILE) {
    const file = resolve(env.SWARM_ENV_FILE);
    try {
      const mode = (await stat(file)).mode & 0o777;
      if ((mode & 0o077) !== 0) throw new Error(`Secrets file ${file} must be chmod 600`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const accountPasswords = {} as SwarmConfig["accountPasswords"];
  for (let index = 1; index <= 8; index += 1) {
    accountPasswords[`bot${index}` as keyof typeof accountPasswords] = swarmUserPassword(env, index);
  }
  const loginEmail = required(env, "SWARM_LOGIN_EMAIL").toLowerCase();
  const config: SwarmConfig = {
    host: env.SWARM_HOST ?? "127.0.0.1",
    port: Number(env.SWARM_PORT ?? 4310),
    terminalPort: Number(env.SWARM_PORT ?? 4310) + 1,
    timezone: env.SWARM_TIMEZONE ?? "Asia/Singapore",
    localAccount: env.SWARM_LOCAL_ACCOUNT?.trim() || userInfo().username,
    loginEmail,
    loginPasswordHash: required(env, "SWARM_LOGIN_PASSWORD_HASH"),
    totpSecret: required(env, "SWARM_TOTP_SECRET"),
    sessionSecret: required(env, "SWARM_SESSION_SECRET"),
    codexBin: env.SWARM_CODEX_BIN ?? "/opt/homebrew/bin/codex",
    trustManagedProxy: bool(env.SWARM_TRUST_MANAGED_PROXY, false),
    masterplanPath: env.SWARM_MASTERPLAN_PATH ?? "manifests/mvp3.json",
    coordinationRoot: env.SWARM_COORDINATION_ROOT?.trim() || resolve(process.cwd(), "../.."),
    ngrok: { enabled: bool(env.SWARM_NGROK_ENABLED, true), bin: env.SWARM_NGROK_BIN ?? "ngrok", authtoken: env.SWARM_NGROK_AUTHTOKEN, url: env.SWARM_NGROK_URL?.trim() || env.SWARM_NGROK_DOMAIN?.trim() || undefined, start: env.SWARM_NGROK_START ?? "10:00", stop: env.SWARM_NGROK_STOP ?? "00:00" },
    accountPasswords,
    publicConfig: () => JSON.stringify({ host: config.host, port: config.port, terminalPort: config.terminalPort, timezone: config.timezone, ngrokEnabled: config.ngrok.enabled, localAccount: config.localAccount }),
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("SWARM_PORT must be a valid port");
  if (!Number.isInteger(config.terminalPort) || config.terminalPort < 1 || config.terminalPort > 65535) throw new Error("SWARM_PORT must leave a valid adjacent loopback terminal port");
  if (!config.codexBin.startsWith("/")) throw new Error("SWARM_CODEX_BIN must be an absolute path");
  return config;
}

export function configuredSecretValues(config: SwarmConfig): string[] {
  return [
    config.loginPasswordHash,
    config.totpSecret,
    config.sessionSecret,
    config.ngrok.authtoken,
    ...Object.values(config.accountPasswords),
  ].filter((value): value is string => Boolean(value));
}
