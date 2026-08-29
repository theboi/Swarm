import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { absorbStdinPipeErrors } from "./commandRunner.js";

describe("GitCommandRunner", () => {
  it("absorbs a late password-pipe EPIPE so a failed su pull cannot terminate Swarm", () => {
    const stdin = new EventEmitter();

    absorbStdinPipeErrors(stdin);

    expect(stdin.listenerCount("error")).toBe(1);
    expect(() => stdin.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }))).not.toThrow();
  });
});
