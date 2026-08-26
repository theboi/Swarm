import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApprovalResponse, classifyApproval, createTestApprovalContext } from "./approvalPolicy.js";

let directory: string | undefined;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function approvedWorkspace() {
  directory = await mkdtemp(join(tmpdir(), "swarm-approval-"));
  const root = join(directory, "EdenMind");
  await mkdir(join(root, "dist"), { recursive: true });
  await writeFile(join(root, "fixture.md"), "fixture");
  return realpath(root);
}

describe("classifyApproval", () => {
  it("keeps stable-v2 command requests human-required and auto-accepts only an owned legacy patch", async () => {
    const root = await approvedWorkspace();
    const context = createTestApprovalContext("bot1", root);

    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "rm -rf dist", cwd: root } }, context)).resolves.toMatchObject({ outcome: "human_required", targets: [join(root, "dist")] });
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "git pull", cwd: root } }, context)).resolves.toMatchObject({ outcome: "human_required", targets: [root] });
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "git push", cwd: root } }, context)).resolves.toMatchObject({ outcome: "human_required", targets: [root] });
    await expect(classifyApproval({ method: "applyPatchApproval", params: { fileChanges: { [join(root, "fixture.md")]: { type: "update" } } } }, context)).resolves.toMatchObject({ outcome: "auto_accept", targets: [join(root, "fixture.md")] });
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
    const root = await approvedWorkspace();
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command, cwd: root } }, createTestApprovalContext("bot1", root))).resolves.toMatchObject({ outcome: "human_required" });
  });

  it("fails closed when targets cannot be proven contained, v2 does not offer a dynamic decision, or the request method is unknown", async () => {
    const root = await approvedWorkspace();
    const context = createTestApprovalContext("bot1", root);

    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "rm -rf dist", cwd: root } }, context)).resolves.toMatchObject({ outcome: "human_required", reason: expect.stringMatching(/offered/i) });
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "git push", cwd: root } }, context)).resolves.toMatchObject({ outcome: "human_required", reason: expect.stringMatching(/offered/i) });
    await expect(classifyApproval({ method: "item/fileChange/requestApproval", params: { grantRoot: "/Users/bot2/Dev/EdenMind" } }, context)).resolves.toMatchObject({ outcome: "human_required" });
    await expect(classifyApproval({ method: "item/permissions/requestApproval", params: { cwd: root, permissions: { fileSystem: { writableRoots: ["/Users/bot2/Dev/EdenMind"] }, network: null } } }, context)).resolves.toMatchObject({ outcome: "human_required" });
    await expect(classifyApproval({ method: "surprise/request", params: {} }, context)).resolves.toMatchObject({ outcome: "decline" });
  });
});

describe("buildApprovalResponse", () => {
  it("emits only the response envelope valid for the exact app-server approval method", async () => {
    const root = await approvedWorkspace();
    const context = createTestApprovalContext("bot1", root);
    expect(() => buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: {} }, { kind: "accept" })).toThrow(/offered/i);
    expect(buildApprovalResponse({ method: "item/fileChange/requestApproval", params: {} }, { kind: "decline" })).toEqual({ decision: "decline" });
    expect(buildApprovalResponse({ method: "item/permissions/requestApproval", params: { permissions: { network: null, fileSystem: { read: [], write: [root] } } } }, { kind: "grant", permissions: { fileSystem: { write: [root] } }, scope: "turn", strictAutoReview: true }, context)).toEqual({ permissions: { fileSystem: { write: [root] } }, scope: "turn", strictAutoReview: true });
    expect(buildApprovalResponse({ method: "execCommandApproval", params: {} }, { kind: "accept" })).toEqual({ decision: "approved" });
    expect(buildApprovalResponse({ method: "applyPatchApproval", params: {} }, { kind: "decline" })).toEqual({ decision: "denied" });
  });

  it("refuses generic or unavailable approvals instead of manufacturing an accept decision", () => {
    expect(() => buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: {} }, { kind: "accept" })).toThrow(/offered/i);
    expect(() => buildApprovalResponse({ method: "surprise/request", params: {} }, { kind: "decline" })).toThrow(/unknown/i);
  });

  it("rejects unrequested, outside-clone, malformed, and session-scoped permission grants", async () => {
    const root = await approvedWorkspace();
    const request = {
      method: "item/permissions/requestApproval",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        environmentId: null,
        startedAtMs: 1_000,
        cwd: root,
        reason: "write fixture",
        permissions: { network: null, fileSystem: { read: [root], write: [root] } },
      },
    };
    const context = createTestApprovalContext("bot1", root);

    expect(() => buildApprovalResponse(request, { kind: "grant", permissions: { fileSystem: { write: ["/Users/bot2/Dev/EdenMind"] } }, scope: "turn" }, context)).toThrow(/outside|requested|context/i);
    expect(() => buildApprovalResponse(request, { kind: "grant", permissions: { network: { enabled: true } }, scope: "turn" }, context)).toThrow(/requested|network/i);
    expect(() => buildApprovalResponse(request, { kind: "grant", permissions: { fileSystem: { write: [root], entries: [] } }, scope: "turn" }, context)).toThrow(/malformed|unsupported/i);
    expect(() => buildApprovalResponse(request, { kind: "grant", permissions: { fileSystem: { write: [root] } }, scope: "session" }, context)).toThrow(/session|scope/i);
  });
});
