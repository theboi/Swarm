import type { TaskPhase, TaskState } from "../../shared/contracts.js";

export function taskStateLabel(state: TaskState | "unknown", phase?: TaskPhase): string {
  if (state === "unknown") return "Unknown";
  const phaseLabel = phase === "ui" ? "UI" : phase ? phase[0].toUpperCase() + phase.slice(1) : undefined;
  if (!phaseLabel) return state.replaceAll("_", " ");
  if (state === "ready") return `Ready for ${phaseLabel.toLowerCase() === "ui" ? "UI" : phaseLabel.toLowerCase()}`;
  if (state === "complete") return `${phaseLabel} complete`;
  if (state === "running") return `${phaseLabel} in progress`;
  if (state === "blocked") return `${phaseLabel} blocked`;
  if (state === "attention_required") return `${phaseLabel} needs attention`;
  return `${phaseLabel} ${state.replaceAll("_", " ")}`;
}

export function StatusBadge({ state, phase }: { state: TaskState | "unknown"; phase?: TaskPhase }) {
  const label = taskStateLabel(state, phase);
  return <span className={`status-badge status-badge--${state}`}>{label}</span>;
}
