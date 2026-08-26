import { afterEach, describe, expect, it, vi } from "vitest";

import { createHttpCoordinatorApi } from "./api.js";

describe("HTTP coordinator API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("unwraps every read envelope while retaining action result envelopes and credentials", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: { authenticated: true } }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const api = createHttpCoordinatorApi();

    await expect(api.getSession()).resolves.toEqual({ authenticated: true });
    await expect(api.completeLogin({ challengeId: "challenge", code: "123456" })).resolves.toEqual({ data: { authenticated: true } });
    expect(fetch).toHaveBeenCalledWith("/api/v1/auth/session", expect.objectContaining({ credentials: "same-origin" }));
  });
});
