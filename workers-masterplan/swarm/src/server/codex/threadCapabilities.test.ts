import { describe, expect, it } from "vitest";

import { normalizeThreadCapabilities } from "./threadCapabilities.js";

describe("thread capability normalization", () => {
  it("fails closed for missing or malformed app-server capabilities", () => {
    expect(normalizeThreadCapabilities({})).toEqual({ canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false });
    expect(normalizeThreadCapabilities({ capabilities: { canArchive: true, canInterrupt: "yes", canStartTurn: true } })).toEqual({ canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false });
  });
});
