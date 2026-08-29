export function handoffThreadName(name: unknown): string {
  const original = typeof name === "string" && name.trim() ? name.trim() : "Unnamed chat";
  return `(Handoff) ${original}`;
}
