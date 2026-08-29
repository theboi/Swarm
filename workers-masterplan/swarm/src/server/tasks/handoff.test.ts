import { describe, expect, it } from "vitest";

import { handoffThreadName } from "./handoff.js";

describe("handoffThreadName", () => {
  it("prefixes the original chat name and retains an unnamed fallback", () => {
    expect(handoffThreadName("Graph planning")).toBe("(Handoff) Graph planning");
    expect(handoffThreadName(null)).toBe("(Handoff) Unnamed chat");
  });
});
