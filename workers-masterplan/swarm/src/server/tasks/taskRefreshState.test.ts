import { describe, expect, it } from "vitest";

import { refreshTaskGraphAtomically, retainLastGoodTaskGraph } from "./taskRefreshState.js";

describe("retainLastGoodTaskGraph", () => {
  it("keeps the last valid manifest and nodes when a refresh fails", () => {
    const manifest = { blueprintId: "mvp3" };
    const nodes = [{ id: "C3" }];

    expect(retainLastGoodTaskGraph(manifest, nodes, "MANIFEST_INVALID")).toEqual({ manifest, nodes, manifestError: "MANIFEST_INVALID" });
  });

  it("does not mix a newly loaded manifest with old nodes when downstream refresh fails", async () => {
    const previous = { manifest: { blueprintId: "old" }, nodes: [{ id: "old-task" }] };

    const refreshed = await refreshTaskGraphAtomically(previous, async () => {
      const candidateManifest = { blueprintId: "new" };
      void candidateManifest;
      throw new Error("remote completion receipts unavailable");
    }, () => "MANIFEST_INVALID");

    expect(refreshed).toEqual({ ...previous, manifestError: "MANIFEST_INVALID" });
  });
});
