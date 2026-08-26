import type { TaskState } from "../../shared/contracts.js";

export function StatusBadge({ state }: { state: TaskState | "unknown" }) {
  const label = state === "unknown" ? "Unknown" : state.replaceAll("_", " ");
  return <span className={`status-badge status-badge--${state}`}>{label}</span>;
}
