import { describe, expect, it } from "vitest";

import type { ChatModelOption, TaskPhase } from "../shared/contracts.js";
import { phaseDefaultExecutionSettings } from "./turnSettings.js";

const models: ChatModelOption[] = [
  { model: "gpt-5.6-sol", displayName: "GPT-5.6 Sol", supportedEfforts: ["low", "high", "xhigh"], defaultEffort: "low", serviceTiers: [{ id: "standard", name: "Normal" }, { id: "priority", name: "Fast" }], defaultServiceTier: "priority", isDefault: true },
  { model: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", supportedEfforts: ["high", "xhigh"], defaultEffort: "high", serviceTiers: [{ id: "standard", name: "Normal" }, { id: "priority", name: "Fast" }], defaultServiceTier: "priority", isDefault: false },
];

describe("phaseDefaultExecutionSettings", () => {
  it.each<[TaskPhase, string, string]>([
    ["planning", "gpt-5.6-sol", "high"],
    ["execution", "gpt-5.6-terra", "xhigh"],
    ["ui", "gpt-5.6-sol", "xhigh"],
  ])("uses the requested %s launch defaults", (phase, model, effort) => {
    expect(phaseDefaultExecutionSettings(models, phase)).toEqual({
      model,
      effort,
      serviceTier: "standard",
      permissionMode: "full_access",
    });
  });

  it("retains the requested phase settings until a model catalog is available", () => {
    expect(phaseDefaultExecutionSettings([], "planning")).toEqual({
      model: "gpt-5.6-sol",
      effort: "high",
      serviceTier: "standard",
      permissionMode: "full_access",
    });
  });
});
