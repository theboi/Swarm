import type { ThreadCapabilities } from "../../shared/contracts.js";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function normalizeThreadActivity(thread: Record<string, unknown>): "active" | "idle" | undefined {
  const type = record(thread.status)?.type;
  if (type === "active") return "active";
  if (type === "idle" || type === "notLoaded") return "idle";
  return undefined;
}

export function normalizeThreadCapabilities(thread: Record<string, unknown>): ThreadCapabilities {
  const capabilities = record(thread.capabilities);
  if (!capabilities) {
    const status = record(thread.status);
    if (status?.type === "idle") return { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false };
    if (status?.type === "active") return { canArchive: false, canInterrupt: true, canStartTurn: false, canSteer: true };
    if (status?.type === "notLoaded") return { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false };
  }
  return {
    canArchive: capabilities?.canArchive === true,
    canInterrupt: capabilities?.canInterrupt === true,
    canStartTurn: capabilities?.canStartTurn === true,
    canSteer: capabilities?.canSteer === true,
  };
}
