import type { RateLimitWindow } from "../shared/contracts.js";

export function remainingPercent(window: RateLimitWindow | undefined): number | null {
  return typeof window?.usedPercent === "number" ? Math.max(0, Math.min(100, 100 - window.usedPercent)) : null;
}

export function usageTone(remaining: number | null): "unknown" | "healthy" | "warning" | "critical" {
  if (remaining === null) return "unknown";
  if (remaining >= 50) return "healthy";
  if (remaining >= 20) return "warning";
  return "critical";
}
