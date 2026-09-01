import { describe, expect, it } from "vitest";

import { retainLastGoodTaskGraph } from "./taskRefreshState.js";

describe("retainLastGoodTaskGraph", () => {
  it("keeps the last valid manifest and nodes when a refresh fails", () => {
    const manifest = { blueprintId: "mvp3" };
    const nodes = [{ id: "C3" }];

    expect(retainLastGoodTaskGraph(manifest, nodes, "MANIFEST_INVALID")).toEqual({ manifest, nodes, manifestError: "MANIFEST_INVALID" });
  });
});
