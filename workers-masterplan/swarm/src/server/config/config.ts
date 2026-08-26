import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export interface SwarmConfig {
  host: string;
  port: number;
  timezone: string;
  loginEmail: string;
  loginPasswordHash: string;
  totpSecret: string;
  sessionSecret: string;
  codexBin: string;
  trustManagedProxy: boolean;
  defaultConcurrency: number;
  masterplanPath: string | undefined;
  coordinationRoot: string | undefined;
  ngrok: { enabled: boolean; bin: string; authtoken: string | undefined; domain: string | undefined; start: string; stop: string };
  accountPasswords: Record<`bot${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`, string>;
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

export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<SwarmConfig> {
  if (env.SWARM_ENV_FILE) {
    const file = resolve(env.SWARM_ENV_FILE);
    const mode = (await stat(file)).mode & 0o777;
    if ((mode & 0o077) !== 0) throw new Error(`Secrets file ${file} must be chmod 600`);
  }
  const accountPasswords = {} as SwarmConfig["accountPasswords"];
  for (let index = 1; index <= 8; index += 1) {
    accountPasswords[`bot${index}` as keyof typeof accountPasswords] = required(env, `BOT${index}_PASSWORD`);
  }
  const loginEmail = required(env, "SWARM_LOGIN_EMAIL").toLowerCase();
  const config: SwarmConfig = {
    host: env.SWARM_HOST ?? "127.0.0.1",
    port: Number(env.SWARM_PORT ?? 4310),
    timezone: env.SWARM_TIMEZONE ?? "Asia/Singapore",
    loginEmail,
    loginPasswordHash: required(env, "SWARM_LOGIN_PASSWORD_HASH"),
    totpSecret: required(env, "SWARM_TOTP_SECRET"),
    sessionSecret: required(env, "SWARM_SESSION_SECRET"),
    codexBin: env.SWARM_CODEX_BIN ?? "/opt/homebrew/bin/codex",
    trustManagedProxy: bool(env.SWARM_TRUST_MANAGED_PROXY, false),
    defaultConcurrency: Number(env.SWARM_DEFAULT_CONCURRENCY ?? 3),
    masterplanPath: env.SWARM_MASTERPLAN_PATH,
    coordinationRoot: env.SWARM_COORDINATION_ROOT,
    ngrok: { enabled: bool(env.SWARM_NGROK_ENABLED, true), bin: env.SWARM_NGROK_BIN ?? "ngrok", authtoken: env.SWARM_NGROK_AUTHTOKEN, domain: env.SWARM_NGROK_DOMAIN, start: env.SWARM_NGROK_START ?? "10:00", stop: env.SWARM_NGROK_STOP ?? "00:00" },
    accountPasswords,
    publicConfig: () => JSON.stringify({ host: config.host, port: config.port, timezone: config.timezone, defaultConcurrency: config.defaultConcurrency, ngrokEnabled: config.ngrok.enabled }),
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("SWARM_PORT must be a valid port");
  if (!Number.isInteger(config.defaultConcurrency) || config.defaultConcurrency < 1) throw new Error("SWARM_DEFAULT_CONCURRENCY must be positive");
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
