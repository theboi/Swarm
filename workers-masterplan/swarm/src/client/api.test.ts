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

  it("requests a local terminal only through the allowlisted account route", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", { location: { protocol: "http:", hostname: "127.0.0.1", port: "4310" } });

    await (createHttpCoordinatorApi() as unknown as { openTerminal(accountId: string): Promise<unknown> }).openTerminal("bot3");

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:4311/api/v1/accounts/bot3/terminal", expect.objectContaining({ method: "POST", credentials: "include" }));
  });

  it("keeps terminal control on the same Tailscale host and adjacent control port", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", { location: { protocol: "http:", hostname: "100.90.80.70", port: "4310" } });

    await (createHttpCoordinatorApi() as unknown as { openTerminal(accountId: string): Promise<unknown> }).openTerminal("bot3");

    expect(fetch).toHaveBeenCalledWith("http://100.90.80.70:4311/api/v1/accounts/bot3/terminal", expect.objectContaining({ method: "POST", credentials: "include" }));
  });

  it("reconnects an account through the authenticated account route", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);

    await (createHttpCoordinatorApi() as unknown as { connectAccount(accountId: string): Promise<unknown> }).connectAccount("bot3");

    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3/connect", expect.objectContaining({ method: "POST" }));
  });

  it("sends editable launch prompts and refreshes all account usage through authenticated routes", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const api = createHttpCoordinatorApi();

    await api.previewLaunch("U1", "bot3");
    const settings = { model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" as const };
    await api.launch("U1", "bot3", "Use the revised plan.", settings);
    await api.refreshAllRateLimits();

    expect(fetch).toHaveBeenCalledWith("/api/v1/tasks/U1/preview", expect.objectContaining({ method: "POST", body: JSON.stringify({ accountId: "bot3" }) }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/tasks/U1/launch", expect.objectContaining({ method: "POST", body: JSON.stringify({ accountId: "bot3", prompt: "Use the revised plan.", settings }) }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/rate-limits/refresh", expect.objectContaining({ method: "POST" }));
  });

  it("reads each account's available models and sends explicit turn execution settings", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const api = createHttpCoordinatorApi();
    const settings = { model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" as const };

    await api.listModels("bot3");
    await api.startTurn("bot3", "thread-1", "Run the release checks.", settings);

    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3/models", expect.objectContaining({ credentials: "same-origin" }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3/threads/thread-1/turns", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ text: "Run the release checks.", settings }),
    }));
  });

  it("requests a cross-account continuation through the authenticated move route", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);

    await createHttpCoordinatorApi().moveThreadToAccount("bot3", "thread-1", "bot1");

    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3/threads/thread-1/move", expect.objectContaining({ method: "POST", body: JSON.stringify({ targetAccountId: "bot1" }) }));
  });
});
