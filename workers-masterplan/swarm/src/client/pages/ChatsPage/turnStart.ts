

export function turnIdFromStart(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const turn = (value as Record<string, unknown>).turn;
  return turn && typeof turn === "object" && !Array.isArray(turn) && typeof (turn as Record<string, unknown>).id === "string"
    ? (turn as Record<string, string>).id
    : undefined;
}

export function queuedTurnFromStart(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).queued === true);
}
