import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApprovalResponse, classifyApproval } from "./approvalPolicy.js";

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
  it("auto-accepts only realpath-proven generated deletion, exact Git transport, and owned legacy patch changes", async () => {
    const root = await approvedWorkspace();
    const context = { account: "bot1" as const, workspaceRoot: root };

    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "rm -rf dist", cwd: root, availableDecisions: ["accept", "decline"] } }, context)).resolves.toMatchObject({ outcome: "auto_accept", targets: [join(root, "dist")] });
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "git pull", cwd: root, availableDecisions: ["accept", "decline"] } }, context)).resolves.toMatchObject({ outcome: "auto_accept", targets: [root] });
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "git push", cwd: root, availableDecisions: ["accept", "decline"] } }, context)).resolves.toMatchObject({ outcome: "auto_accept", targets: [root] });
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
    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command, cwd: root, availableDecisions: ["accept", "acceptForSession", "decline"] } }, { account: "bot1", workspaceRoot: root })).resolves.toMatchObject({ outcome: "human_required" });
  });

  it("fails closed when targets cannot be proven contained, no safe offered decision exists, or the request method is unknown", async () => {
    const root = await approvedWorkspace();
    const context = { account: "bot1" as const, workspaceRoot: root };

    await expect(classifyApproval({ method: "item/commandExecution/requestApproval", params: { command: "rm -rf dist", cwd: root, availableDecisions: ["decline"] } }, context)).resolves.toMatchObject({ outcome: "human_required", reason: expect.stringMatching(/offered/i) });
    await expect(classifyApproval({ method: "item/fileChange/requestApproval", params: { grantRoot: "/Users/bot2/Dev/EdenMind" } }, context)).resolves.toMatchObject({ outcome: "human_required" });
    await expect(classifyApproval({ method: "item/permissions/requestApproval", params: { cwd: root, permissions: { fileSystem: { writableRoots: ["/Users/bot2/Dev/EdenMind"] }, network: null } } }, context)).resolves.toMatchObject({ outcome: "human_required" });
    await expect(classifyApproval({ method: "surprise/request", params: {} }, context)).resolves.toMatchObject({ outcome: "decline" });
  });
});

describe("buildApprovalResponse", () => {
  it("emits only the response envelope valid for the exact app-server approval method", () => {
    expect(buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: { availableDecisions: ["accept", "decline"] } }, { kind: "accept" })).toEqual({ decision: "accept" });
    expect(buildApprovalResponse({ method: "item/fileChange/requestApproval", params: { availableDecisions: ["accept", "decline"] } }, { kind: "decline" })).toEqual({ decision: "decline" });
    expect(buildApprovalResponse({ method: "item/permissions/requestApproval", params: {} }, { kind: "grant", permissions: { fileSystem: { writableRoots: ["/Users/bot1/Dev/EdenMind"] } }, scope: "turn", strictAutoReview: true })).toEqual({ permissions: { fileSystem: { writableRoots: ["/Users/bot1/Dev/EdenMind"] } }, scope: "turn", strictAutoReview: true });
    expect(buildApprovalResponse({ method: "execCommandApproval", params: {} }, { kind: "accept" })).toEqual({ decision: "approved" });
    expect(buildApprovalResponse({ method: "applyPatchApproval", params: {} }, { kind: "decline" })).toEqual({ decision: { denied: { rejection: "Declined by coordinator safety policy" } } });
  });

  it("refuses generic or unavailable approvals instead of manufacturing an accept decision", () => {
    expect(buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: {} }, { kind: "accept" })).toEqual({ decision: "accept" });
    expect(() => buildApprovalResponse({ method: "item/commandExecution/requestApproval", params: { availableDecisions: ["decline"] } }, { kind: "accept" })).toThrow(/not offered/i);
    expect(() => buildApprovalResponse({ method: "surprise/request", params: {} }, { kind: "decline" })).toThrow(/unknown/i);
  });
});
