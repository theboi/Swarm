import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function readTemplate(name: string): Promise<string> {
  return readFile(resolve(process.cwd(), "templates", name), "utf8");
}

describe("canonical worker prompts", () => {
  it("preserves the approved source drafts byte-for-byte", async () => {
    const draft = await readTemplate("approved-drafts.md");
    expect(createHash("sha256").update(draft).digest("hex")).toBe(
      "ec1d04911de43e8a4c66dcb09e9cb17c1eb5ce76351f3f971bf99d3bdf6b1053",
    );
  });

  it.each([
    ["planning.md", ["{{WORKER_ID}}", "{{ACCOUNT_ID}}", "{{SPECIFICATION_PATH}}", "{{IMPLEMENTATION_PLAN_PATH}}"]],
    ["execution.md", ["{{WORKER_ID}}", "{{ACCOUNT_ID}}", "{{PLANNING_GATE_PATH}}", "{{IMPLEMENTATION_MODEL}}"]],
    ["ui.md", ["{{WORKER_ID}}", "{{ACCOUNT_ID}}", "{{DEV_SERVER_COMMAND}}", "{{STATUS_PATH}}"]],
  ])("keeps required placeholders in %s", async (name, placeholders) => {
    const template = await readTemplate(name);
    for (const placeholder of placeholders) expect(template).toContain(placeholder);
  });

  it("keeps planning and execution on opposite sides of the gate", async () => {
    const planning = await readTemplate("planning.md");
    const execution = await readTemplate("execution.md");
    expect(planning).toContain("Do not implement product code");
    expect(planning).toContain("worked\nin parallel");
    expect(execution).toContain("Passed planning-gate receipt");
    expect(execution).toContain("Use implementation subagents throughout");
    expect(execution).toContain("Sol High only for additional\nplanning");
  });

  it("keeps UI work draft-first and review-bounded", async () => {
    const ui = await readTemplate("ui.md");
    expect(ui).toContain("Do not write a separate implementation plan");
    expect(ui).toContain("Start `{{DEV_SERVER_COMMAND}}`");
    expect(ui).toContain("Stop at Claudio's review boundary");
  });
});
