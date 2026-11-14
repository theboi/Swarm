import type { RateLimitWindow } from "../../shared/contracts.js";
import { remainingPercent, usageTone } from "../usage.js";

export function RateLimitBar({ label, window, forceEmpty = false }: { label: string; window: RateLimitWindow | undefined; forceEmpty?: boolean }) {
  const remaining = forceEmpty ? 0 : remainingPercent(window);
  return (
    <div className="rate-limit">
      <div className="rate-limit__label"><span>{label} remaining</span><strong>{remaining === null ? "Unknown" : `${remaining}%`}</strong></div>
      <div className="rate-limit__track" aria-label={`${label} remaining: ${remaining === null ? "unknown" : `${remaining}%`}`}>
        {remaining === null ? null : <span className={`rate-limit__fill usage-tone--${usageTone(remaining)}`} style={{ width: `${remaining}%` }} />}
      </div>
      <small>{window?.resetsAt ? `Resets ${new Date(window.resetsAt * 1000).toLocaleString()}` : "Reset time unknown"}</small>
    </div>
  );
}
