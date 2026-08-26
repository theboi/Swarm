import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AtomicStateStore } from "./atomicStateStore.js";
import { createCoordinatorStateStore } from "./atomicStateStore.js";
import { loadConfig } from "../config/config.js";

describe("AtomicStateStore", () => {
  it("rejects secret-like state before it reaches disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-state-"));
    const store = new AtomicStateStore<{ safe?: string }>(join(directory, "state.json"));
    await expect(store.write({ safe: "ok", token: "private" } as never)).rejects.toThrow("secret-like");
    await expect(store.read()).resolves.toEqual({});
    await rm(directory, { recursive: true, force: true });
  });

  it("rejects configured secret values even under harmless field names", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-state-"));
    const store = new AtomicStateStore(join(directory, "state.json"), { secretValues: ["actual-secret"] });
    await expect(store.write({ note: "contains actual-secret" })).rejects.toThrow("secret-like");
    await rm(directory, { recursive: true, force: true });
  });

  it("wires every configured credential into the coordinator state store guard", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-state-"));
    const config = await loadConfig({
      ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`BOT${index + 1}_PASSWORD`, `bot-secret-${index + 1}`])),
      SWARM_LOGIN_EMAIL: "claudio@example.com",
      SWARM_LOGIN_PASSWORD_HASH: "web-hash",
      SWARM_TOTP_SECRET: "totp-secret",
      SWARM_SESSION_SECRET: "session-secret",
      SWARM_NGROK_AUTHTOKEN: "ngrok-secret",
    });
    const store = createCoordinatorStateStore(join(directory, "state.json"), config);
    await expect(store.write({ status: "ngrok-secret" })).rejects.toThrow("secret-like");
    await expect(store.write({ status: "bot-secret-4" })).rejects.toThrow("secret-like");
    await rm(directory, { recursive: true, force: true });
  });

  it("quarantines corrupt JSON instead of overwriting it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-state-"));
    const path = join(directory, "state.json");
    await writeFile(path, "{");
    const store = new AtomicStateStore(path);
    await expect(store.read()).resolves.toEqual({});
    const files = await import("node:fs/promises").then(({ readdir }) => readdir(directory));
    expect(files.some((file) => file.startsWith("state.json.corrupt-"))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  });

  it("keeps the prior file when a temporary write fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-state-"));
    const path = join(directory, "state.json");
    const store = new AtomicStateStore<{ value?: string }>(path);
    await store.write({ value: "prior" });
    const failing = new AtomicStateStore<{ value?: string }>(path, { writeTemp: async () => { throw new Error("disk full"); } });
    await expect(failing.write({ value: "new" })).rejects.toThrow("disk full");
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ value: "prior" });
    await rm(directory, { recursive: true, force: true });
  });
});
