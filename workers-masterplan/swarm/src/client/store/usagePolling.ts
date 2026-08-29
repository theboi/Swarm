const USAGE_POLL_INTERVAL_MS = 60_000;

/** Keeps the displayed account capacity fresh without polling a hidden dashboard. */
export function startUsagePolling(refresh: () => Promise<void>): () => void {
  const run = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  run();
  const timer = window.setInterval(run, USAGE_POLL_INTERVAL_MS);
  return () => window.clearInterval(timer);
}
