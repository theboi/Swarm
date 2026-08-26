import type { RateLimitWindow } from "../../shared/contracts.js";

export function RateLimitBar({ label, window }: { label: string; window: RateLimitWindow | undefined }) {
  const remaining = typeof window?.usedPercent === "number" ? Math.max(0, Math.min(100, 100 - window.usedPercent)) : null;
  return (
    <div className="rate-limit">
      <div className="rate-limit__label"><span>{label} remaining</span><strong>{remaining === null ? "Unknown" : `${remaining}%`}</strong></div>
      <div className="rate-limit__track" aria-label={`${label} remaining: ${remaining === null ? "unknown" : `${remaining}%`}`}>
        {remaining === null ? null : <span className="rate-limit__fill" style={{ width: `${remaining}%` }} />}
      </div>
      <small>{window?.resetsAt ? `Resets ${new Date(window.resetsAt * 1000).toLocaleString()}` : "Reset time unknown"}</small>
    </div>
  );
}
