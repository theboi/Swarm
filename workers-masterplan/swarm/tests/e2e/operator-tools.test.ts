import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { verifyPassword } from "../../src/server/auth/password.js";
import { evaluateTaskReadiness, loadBlueprintEvidence } from "../../src/server/tasks/blueprintEvidence.js";
import { loadManifest } from "../../src/server/tasks/manifestLoader.js";
import { hashPassword } from "../../scripts/hash-password.js";
import { createTotpProvisioningUri, generateTotpSecret } from "../../scripts/generate-totp-secret.js";
import { redactSmokeOutput, resolveSmokeEnvironment } from "../../scripts/smoke-app-server.js";

describe("operator tools", () => {
  it("creates a scrypt value that the coordinator can verify", async () => {
    const storedHash = await hashPassword("correct horse battery staple", "fixed-test-salt");

    expect(storedHash).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    await expect(verifyPassword("correct horse battery staple", storedHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", storedHash)).resolves.toBe(false);
  });

  it("creates an encoded standard TOTP provisioning URI", () => {
    const secret = generateTotpSecret(Buffer.from([0, 1, 2, 3, 4]));
    const uri = createTotpProvisioningUri({ secret, accountName: "claudio+swarm@example.com" });
    const parsed = new URL(uri);

    expect(secret).toBe("AAAQEAYE");
    expect(decodeURIComponent(parsed.pathname)).toBe("/EdenMind Swarm:claudio+swarm@example.com");
    expect(parsed.searchParams.get("secret")).toBe("AAAQEAYE");
    expect(parsed.searchParams.get("issuer")).toBe("EdenMind Swarm");
    expect(parsed.searchParams.get("algorithm")).toBe("SHA1");
    expect(parsed.searchParams.get("digits")).toBe("6");
    expect(parsed.searchParams.get("period")).toBe("30");
  });

  it("skips the app-server smoke without an account or its matching local password", () => {
    expect(resolveSmokeEnvironment({})).toMatchObject({
      kind: "skip",
      code: "SWARM_SMOKE_SKIPPED",
      message: "Set SWARM_SMOKE_ACCOUNT to bot1 through bot8.",
    });
    expect(resolveSmokeEnvironment({ SWARM_SMOKE_ACCOUNT: "bot3" })).toMatchObject({
      kind: "skip",
      code: "SWARM_SMOKE_SKIPPED",
      message: "Set BOT3_PASSWORD in the local ignored .env before running the bot3 smoke.",
    });
  });

  it("gates turn creation and redacts smoke secrets", () => {
    const run = resolveSmokeEnvironment({
      SWARM_SMOKE_ACCOUNT: "bot3",
      BOT3_PASSWORD: "test-local-password",
      SWARM_SMOKE_START_TURN: "false",
    });

    expect(run).toMatchObject({ kind: "run", account: "bot3", startTurn: false });
    expect(resolveSmokeEnvironment({ SWARM_SMOKE_ACCOUNT: "bot3", BOT3_PASSWORD: "test-local-password", SWARM_SMOKE_START_TURN: "true" })).toMatchObject({ kind: "run", startTurn: true });
    expect(redactSmokeOutput("Authorization: Bearer test-local-password", ["test-local-password"])).toBe("Authorization: Bearer [REDACTED]");
  });

  it("keeps the committed MVP3 seed blocked with no launchable workers", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const manifest = await loadManifest(resolve(process.cwd(), "manifests/mvp3.json"), repositoryRoot);
    const evidence = await loadBlueprintEvidence(manifest, {
      fetch: async () => "abcdef012345",
      readRemote: async (path) => readFile(resolve(repositoryRoot, path), "utf8"),
    });

    expect(manifest.tasks).toEqual([]);
    expect(evidence.code).toBe("MASTERPLAN_NOT_READY");
    expect(evaluateTaskReadiness(manifest, evidence)).toEqual([]);
  });

  it("uses the ready manifest only with its explicit fixture authority", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const manifest = await loadManifest(resolve(process.cwd(), "manifests/example-ready.json"), repositoryRoot);
    const evidence = await loadBlueprintEvidence(manifest, {
      fetch: async () => "abcdef012345",
      readRemote: async (path) => readFile(resolve(repositoryRoot, path), "utf8"),
    });

    expect(manifest.masterplanPath).toMatch(/^workers-masterplan\/swarm\/tests\/e2e\/fixtures\//);
    expect(evaluateTaskReadiness(manifest, evidence).find((task) => task.taskId === "I0")?.state).toBe("ready");
  });
});
