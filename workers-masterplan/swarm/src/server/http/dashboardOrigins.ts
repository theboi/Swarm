import { hostname, networkInterfaces } from "node:os";

function originHost(value: string): string {
  return value.includes(":") && !value.startsWith("[") ? `[${value}]` : value;
}

/** Explicit origins served by this machine, including Tailscale interfaces. */
export function dashboardOrigins(port: number, configuredHost: string, machineHostname = hostname()): ReadonlySet<string> {
  const hosts = new Set(["127.0.0.1", "localhost", configuredHost, machineHostname]);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) hosts.add(address.address);
  }
  return new Set([...hosts].filter(Boolean).map((host) => `http://${originHost(host)}:${port}`));
}

/** Accept an explicit machine origin or the exact origin of the current HTTP authority. */
export function isAllowedDashboardOrigin(origin: unknown, requestHost: unknown, allowedOrigins: ReadonlySet<string>): boolean {
  if (typeof origin !== "string") return false;
  if (allowedOrigins.has(origin)) return true;
  if (typeof requestHost !== "string" || !requestHost.trim()) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && !parsed.username
      && !parsed.password
      && parsed.pathname === "/"
      && !parsed.search
      && !parsed.hash
      && parsed.host.toLowerCase() === requestHost.trim().toLowerCase();
  } catch {
    return false;
  }
}
