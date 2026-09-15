import { describe, expect, it } from "vitest";

import { staticAssetDirectory } from "./staticAssets.js";

describe("staticAssetDirectory", () => {
  it("finds the dashboard beside a compiled server regardless of process working directory", () => {
    expect(staticAssetDirectory("file:///opt/swarm/dist-server/server/index.js")).toBe("/opt/swarm/dist");
  });
});
