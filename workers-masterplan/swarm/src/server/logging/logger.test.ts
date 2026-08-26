import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("redacts configured secrets, authorization values, and transcript content", () => {
    const entries: unknown[] = [];
    const logger = createLogger({ secrets: ["very-secret"], write: (entry) => entries.push(entry) });
    logger.info("dispatch", { authorization: "Bearer very-secret", transcript: "private worker output", detail: "very-secret" });
    expect(entries).toEqual([{ level: "info", component: "dispatch", authorization: "[REDACTED]", transcript: "[REDACTED]", detail: "[REDACTED]" }]);
  });
});
