import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function readTemplate(name: string): Promise<string> {
  return readFile(resolve(process.cwd(), "templates", name), "utf8");
}

describe("canonical worker prompts", () => {
  it("includes the user's authority and planning-only instructions in planning launches", async () => {
    const prompt = await readTemplate("planning.md");
    expect(prompt).toContain("Read these repository authorities from the account's EdenMind clone before acting:");
    expect(prompt).toContain("Task specification destination: `{{SPECIFICATION_PATH}}`");
    expect(prompt).toContain("Its phase is `{{PHASE}}`; this is a planning-only launch.");
    expect(prompt).toContain("Do not implement product code, UI, migrations, or runtime behavior in this phase.");
    expect(prompt).toContain("Ask the user focused questions");
    expect(prompt).not.toContain("ask me questions");
  });

  it("includes the user's authority and execution-only instructions in execution launches", async () => {
    const prompt = await readTemplate("execution.md");
    expect(prompt).toContain("Planning-gate receipt: `{{PLANNING_GATE_PATH}}`");
    expect(prompt).toContain("Its phase is `{{PHASE}}`; this is an execution-only launch.");
    expect(prompt).toContain("Confirm every listed execution prerequisite, planning artifact, and planning-gate receipt is reachable from `origin/main`");
    expect(prompt).toContain("ask the user questions when needed.");
    expect(prompt).not.toContain("ask me questions");
  });

  it("includes the user's authority and UI-only instructions in UI launches", async () => {
    const prompt = await readTemplate("ui.md");
    expect(prompt).toContain("Task specification: `{{SPECIFICATION_PATH}}`");
    expect(prompt).toContain("Its phase is `{{PHASE}}`; this is a UI-only launch.");
    expect(prompt).toContain("Confirm every listed UI prerequisite is reachable from `origin/main`");
    expect(prompt).toContain("the user will say which parts require changing.");
  });
});
