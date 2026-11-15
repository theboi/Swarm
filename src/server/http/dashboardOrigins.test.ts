import { describe, expect, it } from "vitest";

import { dashboardOrigins } from "./dashboardOrigins.js";

describe("dashboardOrigins", () => {
  it("allows loopback, the all-interface development address, and the machine hostname", () => {
    const origins = dashboardOrigins(4310, "0.0.0.0", "claudiothe");

    expect(origins.size).toBeGreaterThanOrEqual(4);
    expect(origins.has("http://127.0.0.1:4310")).toBe(true);
    expect(origins.has("http://localhost:4310")).toBe(true);
    expect(origins.has("http://0.0.0.0:4310")).toBe(true);
    expect(origins.has("http://claudiothe:4310")).toBe(true);
  });
});
