import type { ThreadCapabilities } from "../../shared/contracts.js";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function normalizeThreadCapabilities(thread: Record<string, unknown>): ThreadCapabilities {
  const capabilities = record(thread.capabilities);
  return {
    canArchive: capabilities?.canArchive === true,
    canInterrupt: capabilities?.canInterrupt === true,
    canStartTurn: capabilities?.canStartTurn === true,
    canSteer: capabilities?.canSteer === true,
  };
}
