/** Optional process namespace for coordinators running alongside the live instance. */
export function swarmInstanceId(): string | undefined {
  const value = process.env.SWARM_INSTANCE_ID?.trim();
  if (!value) return undefined;
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(value)) throw new Error("SWARM_INSTANCE_ID must contain 1–48 letters, digits, underscores or hyphens");
  return value;
}
