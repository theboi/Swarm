import { describe, expect, it } from "vitest";

import { normalizeThreadActivity, normalizeThreadCapabilities } from "./threadCapabilities.js";

describe("thread capability normalization", () => {
  it("uses explicit capabilities when a compatible app-server supplies them", () => {
    expect(normalizeThreadCapabilities({})).toEqual({ canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false });
    expect(normalizeThreadCapabilities({ capabilities: { canArchive: true, canInterrupt: "yes", canStartTurn: true } })).toEqual({ canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false });
  });

  it("derives controls from current v2 idle and active thread status", () => {
    expect(normalizeThreadCapabilities({ status: { type: "idle" } })).toEqual({ canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false });
    expect(normalizeThreadCapabilities({ status: { type: "active", activeFlags: [] } })).toEqual({ canArchive: false, canInterrupt: true, canStartTurn: false, canSteer: true });
    expect(normalizeThreadCapabilities({ status: { type: "notLoaded" } })).toEqual({ canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false });
  });

  it("retains the app-server activity state independently of transient capabilities", () => {
    expect(normalizeThreadActivity({ status: { type: "active", activeFlags: [] } })).toBe("active");
    expect(normalizeThreadActivity({ status: { type: "idle" } })).toBe("idle");
    expect(normalizeThreadActivity({ status: { type: "notLoaded" } })).toBe("idle");
    expect(normalizeThreadActivity({})).toBeUndefined();
  });
});
