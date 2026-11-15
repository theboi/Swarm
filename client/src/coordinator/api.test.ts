import { afterEach, describe, expect, it, vi } from "vitest";

import { createHttpCoordinatorApi } from "./api.js";

describe("HTTP coordinator API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reuses an unchanged transcript without downloading or parsing its body again", async () => {
    const result = { data: [{ id: "reply" }] };
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(result), { headers: { etag: '"version-1"' } })).mockResolvedValueOnce(new Response(null, { status: 304 }));
    vi.stubGlobal("fetch", fetch);
    const api = createHttpCoordinatorApi();
    const first = await api.readTranscript("bot3", "thread-1");
    expect(await api.readTranscript("bot3", "thread-1")).toBe(first);
    expect(fetch.mock.calls[1][1].headers["if-none-match"]).toBe('"version-1"');
    expect(fetch.mock.calls[1][1].headers["cache-control"]).toBe("max-age=0");
  });


  it("unwraps every read envelope while retaining action result envelopes and credentials", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: { authenticated: true } }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const api = createHttpCoordinatorApi();

    await expect(api.getSession()).resolves.toEqual({ authenticated: true });
    await expect(api.completeLogin({ challengeId: "challenge", code: "123456" })).resolves.toEqual({ data: { authenticated: true } });
    expect(fetch).toHaveBeenCalledWith("/api/v1/auth/session", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("sets auto-pilot through the authenticated mutation route", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: { enabled: true } }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);

    await createHttpCoordinatorApi().setAutoPilot(true);

    expect(fetch).toHaveBeenCalledWith("/api/v1/auto-pilot", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    }));
  });

  it("uses encoded profile routes and sends only the chosen login method", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const api = createHttpCoordinatorApi();

    await api.makePrimary("bot1/acc2");
    await api.addAccount("bot1");
    await api.startAccountLogin("bot1/acc2", "device_code");
    await api.cancelAccountLogin("bot1/acc2");

    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot1%2Facc2/primary", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/bots/bot1/accounts", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot1%2Facc2/login", expect.objectContaining({ method: "POST", body: JSON.stringify({ method: "device_code" }) }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot1%2Facc2/login/cancel", expect.objectContaining({ method: "POST" }));
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

    const settings = { model: "gpt-5.6-terra", effort: "xhigh", serviceTier: "standard", permissionMode: "full_access" as const };
    await createHttpCoordinatorApi().moveThreadToAccount("bot3", "thread-1", "bot1", settings);

    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3/threads/thread-1/move", expect.objectContaining({ method: "POST", body: JSON.stringify({ targetAccountId: "bot1", settings }) }));
  });

  it("renames a chat through its authenticated thread route", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);

    await createHttpCoordinatorApi().renameThread("bot3", "thread-1", "Graph plan review");

    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3/threads/thread-1/name", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Graph plan review" }) }));
  });

  it("updates automatic resume for one chat", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: { enabled: true } }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);

    await createHttpCoordinatorApi().setLimitResumeEnabled("bot3", "thread-1", true);

    expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3/threads/thread-1/limit-resume", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    }));
  });
});


it("uses JSON for todo deletion and preserves a retry message ID when sending", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const api = createHttpCoordinatorApi();
  await api.editQueuedTask("todo/1", " Exact description\n");
  await api.deleteQueuedTask("todo/1");
  await api.startTurn("bot3/acc1", "new-chat", "Prompt", undefined, "stable-message-id");
  expect(fetch).toHaveBeenCalledWith("/api/v1/queued-tasks/todo%2F1", expect.objectContaining({ method: "PUT", body: JSON.stringify({ description: " Exact description\n" }) }));
  expect(fetch).toHaveBeenCalledWith("/api/v1/queued-tasks/todo%2F1", expect.objectContaining({ method: "DELETE", body: "{}" }));
  expect(fetch).toHaveBeenCalledWith("/api/v1/accounts/bot3%2Facc1/threads/new-chat/turns", expect.objectContaining({ body: JSON.stringify({ text: "Prompt", clientUserMessageId: "stable-message-id" }) }));
});
