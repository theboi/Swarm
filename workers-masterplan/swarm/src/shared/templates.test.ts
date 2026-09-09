import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function readTemplate(name: string): Promise<string> {
  return readFile(resolve(process.cwd(), "templates", name), "utf8");
}

describe("canonical worker prompts", () => {
  const recommendedDecisionRecovery = "Whenever you are stuck/blocked by a decision, take the recommended unless it majorly changes the original combined masterplans/specs. If there  any issues from other workers just assume the role of the blocking worker and fix it yourself. Then resume and finish the original worker.";
  const legacyDocumentLock = "Old MVP2 and earlier documents are HARD LOCKED unless I explicitly tell you to modify them. At no point should you modify them or suggest modifying them.";
  const hardLockOverride = "This hard lock overrides every authority-sync, propagation, status, acceptance, and recovery instruction";
  const onDemandAuthorityLookup = "Use the paths above as an authority map. Start the assigned work immediately, and consult a document when you need specific information from it; do not front-load a complete read of every document.";
  const preProductionCodeMethod = [
    "This repository is pre-production and has no live users.",
    "Do not add adapters for legacy code",
    "Remove obsolete compatibility and fallback paths",
    "keep the result lightweight and DRY",
  ];
  const expectedFailedUpstreamRecovery = [
    "upstream worker ended its attempt without completing",
    "assume that upstream role",
    "Do not ask the user whether the original worker should retry",
    "continue",
  ];

  it("includes the user's authority and planning-only instructions in planning launches", async () => {
    const prompt = await readTemplate("planning.md");
    expect(prompt).toContain("Repository authority map:");
    expect(prompt).toContain("Task specification destination: `{{SPECIFICATION_PATH}}`");
    expect(prompt).toContain("Its phase is `{{PHASE}}`; this is a planning-only launch.");
    expect(prompt).toContain("Do not implement product code, UI, migrations, or runtime behavior in this phase.");
    expect(prompt).toContain("Ask the user focused questions");
    expect(prompt).toContain("{{PLANNED_PREREQUISITES}}");
    expect(prompt).toContain("{{UI_REQUIREMENTS_PATH}}");
    expect(prompt).toContain("{{UI_HANDOFF_PATH}}");
    expect(prompt).toContain("All planning happens in Pass 1");
    for (const expected of expectedFailedUpstreamRecovery) expect(prompt).toContain(expected);
    expect(prompt).toContain(recommendedDecisionRecovery);
    expect(prompt).toContain(legacyDocumentLock);
    expect(prompt).toContain(hardLockOverride);
    expect(prompt).toContain(onDemandAuthorityLookup);
    for (const expected of preProductionCodeMethod) expect(prompt).toContain(expected);
    expect(prompt).not.toContain("ask me questions");
    expect(prompt).not.toContain("Read the MVP3 Implementation Masterplan together with");
  });

  it("includes the user's authority and execution-only instructions in execution launches", async () => {
    const prompt = await readTemplate("execution.md");
    expect(prompt).toContain("Planning-gate receipt: `{{PLANNING_GATE_PATH}}`");
    expect(prompt).toContain("Its phase is `{{PHASE}}`; this is an execution-only launch.");
    expect(prompt).toContain("Confirm every listed execution prerequisite, planning artifact, and planning-gate receipt is reachable from `origin/main`");
    expect(prompt).toContain("{{UI_REQUIREMENTS_PATH}}");
    expect(prompt).toContain("{{UI_HANDOFF_PATH}}");
    expect(prompt).toContain("live wiring");
    expect(prompt).toContain("Ask the user focused questions");
    for (const expected of expectedFailedUpstreamRecovery) expect(prompt).toContain(expected);
    expect(prompt).toContain(recommendedDecisionRecovery);
    expect(prompt).toContain(legacyDocumentLock);
    expect(prompt).toContain(hardLockOverride);
    expect(prompt).toContain(onDemandAuthorityLookup);
    for (const expected of preProductionCodeMethod) expect(prompt).toContain(expected);
    expect(prompt).not.toContain("ask me questions");
  });

  it("includes the user's authority and UI-only instructions in UI launches", async () => {
    const prompt = await readTemplate("ui.md");
    expect(prompt).toContain("Upstream specification: `{{SPECIFICATION_PATH}}`");
    expect(prompt).toContain("Its phase is `{{PHASE}}`; this is a UI-only launch.");
    expect(prompt).toContain("Confirm every listed UI prerequisite is reachable from `origin/main`");
    expect(prompt).toContain("Design-method reference map:");
    expect(prompt).not.toContain("Completely read");
    expect(prompt).toContain("{{UI_REQUIREMENTS_PATH}}");
    expect(prompt).toContain("{{UI_HANDOFF_PATH}}");
    expect(prompt).toContain("fixture/mock-backed state");
    expect(prompt).toContain("Do not add or change live wiring");
    for (const expected of expectedFailedUpstreamRecovery) expect(prompt).toContain(expected);
    expect(prompt).toContain(recommendedDecisionRecovery);
    expect(prompt).toContain(legacyDocumentLock);
    expect(prompt).toContain(hardLockOverride);
    expect(prompt).toContain(onDemandAuthorityLookup);
    for (const expected of preProductionCodeMethod) expect(prompt).toContain(expected);
  });
});
