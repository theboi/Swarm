import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { absorbSpawnError, fetchNgrokInspector } from "./index.js";

describe("runtime startup", () => {
  it("bounds the local ngrok inspector request so a missing tunnel cannot stall the coordinator", async () => {
    let signal: AbortSignal | undefined;
    const value = await fetchNgrokInspector(async (_input, init) => {
      signal = init?.signal as AbortSignal | undefined;
      return { ok: true, json: async () => ({ tunnels: [] }) } as Response;
    });

    expect(value).toEqual({ tunnels: [] });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it("absorbs an ngrok spawn error so the coordinator process remains alive", () => {
    const child = new EventEmitter();
    absorbSpawnError(child);

    expect(() => child.emit("error", new Error("spawn ngrok ENOENT"))).not.toThrow();
  });
});
