function parts(date: Date, timezone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}
function offsetMinutes(date: Date, timezone: string): number {
  const value = parts(date, timezone).timeZoneName ?? "GMT";
  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(value);
  return match ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 0;
}
function atLocal(date: Date, timezone: string, hour: number, plusDays = 0): Date {
  const local = parts(date, timezone);
  const midnight = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day) + plusDays, hour);
  return new Date(midnight - offsetMinutes(date, timezone) * 60_000);
}
export function isNgrokWindowOpen(now: Date, timezone = "Asia/Singapore"): boolean { const hour = Number(parts(now, timezone).hour); return hour >= 10 && hour < 24; }
export function nextNgrokBoundary(now: Date, timezone = "Asia/Singapore"): Date { const target = isNgrokWindowOpen(now, timezone) ? atLocal(now, timezone, 0, 1) : atLocal(now, timezone, 10); return target <= now ? atLocal(now, timezone, isNgrokWindowOpen(now, timezone) ? 0 : 10, isNgrokWindowOpen(now, timezone) ? 2 : 1) : target; }
export function nextNgrokStart(now: Date, timezone = "Asia/Singapore"): Date { const candidate = atLocal(now, timezone, 10); return candidate > now ? candidate : atLocal(now, timezone, 10, 1); }
