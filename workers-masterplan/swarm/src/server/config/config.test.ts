import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("requires every bot password and keeps secrets out of its public view", async () => {
    const env = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`BOT${index + 1}_PASSWORD`, "local-password"]));
    const config = await loadConfig({
      ...env,
      SWARM_LOGIN_EMAIL: "Claudio@Example.com",
      SWARM_LOGIN_PASSWORD_HASH: "scrypt$16384$8$1$c2FsdA==$ZGlnaWVzdA==",
      SWARM_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
      SWARM_SESSION_SECRET: "a session secret",
      SWARM_NGROK_AUTHTOKEN: "ngrok-secret",
    });

    expect(config.loginEmail).toBe("claudio@example.com");
    expect(config.publicConfig()).not.toContain("local-password");
    expect(config.publicConfig()).not.toContain("ngrok-secret");
  });

  it("uses an explicit absolute Codex binary and never enables proxy trust by default", async () => {
    const env = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`BOT${index + 1}_PASSWORD`, "local-password"]));

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
