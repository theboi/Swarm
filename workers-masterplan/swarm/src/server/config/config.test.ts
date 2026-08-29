import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("rejects a group-readable environment file with chmod remediation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-config-"));
    const envFile = join(directory, ".env");
    await writeFile(envFile, "SWARM_LOGIN_EMAIL=claudio@example.com\n");
    await chmod(envFile, 0o640);

    await expect(loadConfig({ SWARM_ENV_FILE: envFile })).rejects.toThrow("chmod 600");
    await rm(directory, { recursive: true, force: true });
  });

  it("accepts process-supplied configuration when the optional default .env does not exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-config-missing-"));
    const missingEnvFile = join(directory, ".env");
    const config = await loadConfig({
      SWARM_ENV_FILE: missingEnvFile,
      SWARM_LOGIN_EMAIL: "claudio@example.com",
      SWARM_LOGIN_PASSWORD_HASH: "hash",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "session",
    });

    expect(config.loginEmail).toBe("claudio@example.com");
    await rm(directory, { recursive: true, force: true });
  });

  it("uses the MVP3 manifest and EdenMind repository root when path settings are omitted", async () => {
    const config = await loadConfig({
      SWARM_LOGIN_EMAIL: "claudio@example.com",
      SWARM_LOGIN_PASSWORD_HASH: "hash",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "session",
    });

    expect(config.masterplanPath).toBe("manifests/mvp3.json");
    expect(config.coordinationRoot).toBe(resolve(process.cwd(), "../.."));
    expect(config.terminalPort).toBe(config.port + 1);
  });

  it("has no global concurrency setting or public limit", async () => {
    const config = await loadConfig({
      SWARM_LOGIN_EMAIL: "claudio@example.com",
      SWARM_LOGIN_PASSWORD_HASH: "hash",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "session",
      SWARM_DEFAULT_CONCURRENCY: "0",
    });

    expect(config).not.toHaveProperty("defaultConcurrency");
    expect(config.publicConfig()).not.toContain("defaultConcurrency");
  });

  it("requires a main port that leaves a valid adjacent loopback terminal port", async () => {
    await expect(loadConfig({
      SWARM_LOGIN_EMAIL: "claudio@example.com",
      SWARM_LOGIN_PASSWORD_HASH: "hash",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "session",
      SWARM_PORT: "65535",
    })).rejects.toThrow("SWARM_PORT must leave a valid adjacent loopback terminal port");
  });

  it("reads bot credentials only from named SWARM_USER slots and keeps passwords out of its public view", async () => {
    const env = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`SWARM_USER${index + 1}`, `bot${index + 1}:local-password-${index + 1}`]));
    const config = await loadConfig({
      ...env,
      SWARM_LOGIN_EMAIL: "Claudio@Example.com",
      SWARM_LOGIN_PASSWORD_HASH: "scrypt$16384$8$1$c2FsdA==$ZGlnaWVzdA==",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "a session secret",
      SWARM_NGROK_AUTHTOKEN: "ngrok-secret",
      SWARM_NGROK_URL: "tosha-protrudent-ternately.ngrok-free.dev",
    });

    expect(config.loginEmail).toBe("claudio@example.com");
    expect(config.accountPasswords.bot3).toBe("local-password-3");
    expect(config.accountPasswords.bot8).toBe("local-password-8");
    expect(config.ngrok.url).toBe("tosha-protrudent-ternately.ngrok-free.dev");
    expect(config.publicConfig()).not.toContain("local-password");
    expect(config.publicConfig()).not.toContain("ngrok-secret");
  });

  it("leaves an unset bot credential unavailable and rejects a mismatched SWARM_USER name", async () => {
    const base = {
      SWARM_LOGIN_EMAIL: "claudio@example.com",
      SWARM_LOGIN_PASSWORD_HASH: "hash",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "session",
      SWARM_USER1: "bot1:password",
      BOT2_PASSWORD: "ignored-password",
    };

    await expect(loadConfig(base)).resolves.toMatchObject({ accountPasswords: { bot1: "password", bot2: undefined } });
    await expect(loadConfig({ ...base, SWARM_USER2: "bot3:password" })).rejects.toThrow("SWARM_USER2 must start with bot2:");
  });

  it("uses an explicit absolute Codex binary and never enables proxy trust by default", async () => {
    const env = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`SWARM_USER${index + 1}`, `bot${index + 1}:local-password`]));

    const config = await loadConfig({
      ...env,
      SWARM_LOGIN_EMAIL: "claudio@example.com",
      SWARM_LOGIN_PASSWORD_HASH: "hash",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "session",
      SWARM_CODEX_BIN: "/custom/codex",
    });

    expect(config.codexBin).toBe("/custom/codex");
    expect(config.trustManagedProxy).toBe(false);
    expect(config.publicConfig()).not.toContain("/custom/codex");
  });
});
