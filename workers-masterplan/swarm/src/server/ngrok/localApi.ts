type JsonFetcher = () => Promise<unknown>;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function findNgrokPublicUrl(value: unknown, target: string): string | null {
  const tunnels = record(value)?.tunnels;
  if (!Array.isArray(tunnels)) return null;
  for (const candidate of tunnels) {
    const tunnel = record(candidate);
    const publicUrl = typeof tunnel?.public_url === "string" ? tunnel.public_url : undefined;
    const address = typeof record(tunnel?.config)?.addr === "string" ? record(tunnel?.config)?.addr : undefined;
    if (!publicUrl || address !== target) continue;
    try {
      const parsed = new URL(publicUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return publicUrl;
    } catch { /* ignore malformed inspector data */ }
  }
  return null;
}

export async function waitForNgrokPublicUrl(options: { target: string; fetchJson: JsonFetcher; sleep: () => Promise<void>; attempts?: number }): Promise<string> {
  const attempts = options.attempts ?? 20;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const url = findNgrokPublicUrl(await options.fetchJson(), options.target);
      if (url) return url;
    } catch { /* inspector may not be ready yet */ }
    if (attempt + 1 < attempts) await options.sleep();
  }
  throw new Error("ngrok did not report a public URL through its loopback inspector");
}
