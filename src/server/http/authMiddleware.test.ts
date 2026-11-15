import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionCookieName } from "./authMiddleware.js";

describe("instance session cookie", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("keeps the default cookie and isolates configured instances", () => {
    vi.stubEnv("SWARM_INSTANCE_ID", "");
    expect(sessionCookieName()).toBe("swarm_session");
    vi.stubEnv("SWARM_INSTANCE_ID", "test-4320");
    expect(sessionCookieName()).toBe("swarm_session_test-4320");
  });
  it("rejects unsafe instance names", () => {
    vi.stubEnv("SWARM_INSTANCE_ID", "bad; command");
    expect(() => sessionCookieName()).toThrow("SWARM_INSTANCE_ID");
  });
});
