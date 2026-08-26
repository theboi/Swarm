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

  it("returns only the displayed requested permissions for an explicit grant", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const requestedPermissions = { network: { enabled: true } };
    const approval = {
      id: "approval-1", accountId: "bot1" as const, threadId: "thread-1", turnId: "turn-1", itemId: "item-1",
      method: "item/permissions/requestApproval", summary: "grant", availableDecisions: ["grant_turn"], createdAt: 1, requestedPermissions,
    };

    await createHttpCoordinatorApi().decideApproval(approval, "grant_turn", requestedPermissions);

    expect(fetch).toHaveBeenCalledWith("/api/v1/approvals/approval-1", expect.objectContaining({
      method: "POST", body: JSON.stringify({ decision: "grant_turn", permissions: requestedPermissions }),
    }));
  });
});
