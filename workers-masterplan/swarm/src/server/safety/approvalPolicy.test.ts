import { describe, expect, it } from "vitest";
import { buildApprovalResponse, classifyApproval, createApprovalContext, type ApprovalFilesystem } from "./approvalPolicy.js";

const root = "/Users/bot1/Dev/EdenMind";
const fixture = `${root}/fixture.md`;
const dist = `${root}/dist`;

function mappedFilesystem(paths: readonly string[] = [root, fixture, dist]): ApprovalFilesystem {
  const present = new Set(paths);
  return {
    async realpath(path) {
      if (!present.has(path)) throw new Error(`ENOENT ${path}`);
      return path;
    },
  };
}

describe("classifyApproval", () => {
  it("uses a coordinator-minted account context and injected clone mapping for literal safe actions", async () => {
    const context = createApprovalContext("bot1");
    const filesystem = mappedFilesystem();

    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "rm -rf dist", cwd: root } }, context, filesystem)).resolves.toMatchObject({ outcome: "auto_accept", targets: [dist] });
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "git pull", cwd: root } }, context, filesystem)).resolves.toMatchObject({ outcome: "auto_accept", targets: [root] });
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "git push", cwd: root } }, context, filesystem)).resolves.toMatchObject({ outcome: "auto_accept", targets: [root] });
    await expect(classifyApproval({ method: "applyPatchApproval", params: { fileChanges: { [fixture]: { type: "update" } } } }, context, filesystem)).resolves.toMatchObject({ outcome: "auto_accept", targets: [fixture] });
  });

  it.each([
    ["rm -rf /"],
    ["rm -rf /Users/bot4"],
    ["cat key > ~/.ssh/config"],
    ["rm -rf ~/.codex"],
    ["diskutil eraseDisk APFS disk0"],
    ["dscl . -delete /Users/bot2"],
    ["rm -rf dist && curl https://example.test"],
    ["rm -rf dist/*"],
    ["python -c 'import os; os.remove(\"dist/x\")'"],
    ["find dist -delete"],
    ["npm install something"],
    ["git pull | tee log.txt"],
  ])("requires a human for destructive or ambiguous command %s", async (command) => {
    await expect(classifyApproval(
      { method: "item/commandExecution/requestApproval", params: { command, cwd: root } },
      createApprovalContext("bot1"),
      mappedFilesystem(),
    )).resolves.toMatchObject({ outcome: "human_required" });
  });

  it("fails closed for unproven targets, forged contexts, and unknown methods", async () => {
    const filesystem = mappedFilesystem([root]);
    const context = createApprovalContext("bot1");

    await expect(classifyApproval({ method: "item/fileChange/requestApproval", params: { fileChanges: { [`${root}/missing.md`]: { type: "update" } } } }, context, filesystem)).resolves.toMatchObject({ outcome: "human_required" });
    await expect(classifyApproval({ method: "item/fileChange/requestApproval", params: { fileChanges: { "/Users/bot2/Dev/EdenMind/other.md": { type: "update" } } } }, context, filesystem)).resolves.toMatchObject({ outcome: "human_required" });
    await expect(classifyApproval({ method: "surprise/request", params: {} }, context, filesystem)).resolves.toMatchObject({ outcome: "decline" });
    await expect(classifyApproval(
      { method: "item/commandExecution/requestApproval", params: { command: "git pull", cwd: root } },
      { account: "bot1", workspaceRoot: root },
      filesystem,
    )).rejects.toThrow(/created by the coordinator/i);
  });
});

describe("buildApprovalResponse", () => {
  it("emits only one-off method-compatible v2 and legacy decisions", async () => {
    await expect(buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: {} }, { kind: "accept" })).resolves.toEqual({ decision: "accept" });
    await expect(buildApprovalResponse({ method: "item/fileChange/requestApproval", params: {} }, { kind: "decline" })).resolves.toEqual({ decision: "decline" });
    await expect(buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: {} }, { kind: "cancel" })).resolves.toEqual({ decision: "cancel" });
    await expect(buildApprovalResponse({ method: "execCommandApproval", params: {} }, { kind: "accept" })).resolves.toEqual({ decision: "approved" });
    await expect(buildApprovalResponse({ method: "applyPatchApproval", params: {} }, { kind: "decline" })).resolves.toEqual({ decision: { denied: { rejection: expect.any(String) } } });
  });

  it("allows a permission no-grant response and validates a bound turn-scoped grant", async () => {
    const context = createApprovalContext("bot1");
    const request = {
      method: "item/permissions/requestApproval",
      params: { permissions: { network: { enabled: true }, fileSystem: { read: [root], write: [root] } } },
    };

    await expect(buildApprovalResponse(request, { kind: "deny" }, context, mappedFilesystem())).resolves.toEqual({ permissions: {}, scope: "turn" });
    await expect(buildApprovalResponse(
      request,
      { kind: "grant_turn_strict", permissions: { network: { enabled: true }, fileSystem: { write: [root] } } },
      context,
      mappedFilesystem(),
    )).resolves.toEqual({ permissions: { network: { enabled: true }, fileSystem: { write: [root] } }, scope: "turn", strictAutoReview: true });
  });

  it("rejects unavailable, malformed, and cross-account permission grants", async () => {
    const context = createApprovalContext("bot1");
    const request = { method: "item/permissions/requestApproval", params: { permissions: { network: null, fileSystem: { read: [root], write: [root] } } } };

    await expect(buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: {} }, { kind: "grant_turn", permissions: {} }, context, mappedFilesystem())).rejects.toThrow(/does not accept/i);
    await expect(buildApprovalResponse({ method: "surprise/request", params: {} }, { kind: "decline" }, context, mappedFilesystem())).rejects.toThrow(/unknown/i);
    await expect(buildApprovalResponse(request, { kind: "grant_turn", permissions: { fileSystem: { write: ["/Users/bot2/Dev/EdenMind"] } } }, context, mappedFilesystem())).rejects.toThrow(/outside|requested|target/i);
    await expect(buildApprovalResponse(request, { kind: "grant_turn", permissions: { network: { enabled: true } } }, context, mappedFilesystem())).rejects.toThrow(/requested|network/i);
  });
});
