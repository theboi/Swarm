import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

import { createDashboardRouter, staticAssetDirectory } from "./staticAssets.js";

describe("staticAssetDirectory", () => {
  it("serves screen HTML before Next's adjacent fragment directories can redirect the URL", async () => {
    const directory = await mkdtemp(join(tmpdir(), "swarm-next-export-"));
    try {
      await mkdir(join(directory, "queued-tasks"));
      await writeFile(join(directory, "queued-tasks.html"), "<h1>Queued tasks export</h1>");
      await writeFile(join(directory, "index.html"), "<h1>Root export</h1>");
      const app = express().use(createDashboardRouter(directory));
      for (const path of ["/queued-tasks", "/queued-tasks/", "/queued-tasks?view=list"]) {
        const response = await request(app).get(path).expect(200);
        expect(response.text).toBe("<h1>Queued tasks export</h1>");
        expect(response.headers.location).toBeUndefined();
      }
      expect((await request(app).get("/").expect(200)).text).toBe("<h1>Root export</h1>");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("finds the dashboard beside a compiled server regardless of process working directory", () => {
    expect(staticAssetDirectory("file:///opt/swarm/dist-server/server/index.js")).toBe("/opt/swarm/client/out");
  });
});
