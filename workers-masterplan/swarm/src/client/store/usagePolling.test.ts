import { describe, expect, it, vi } from "vitest";

import { startUsagePolling } from "./usagePolling.js";

describe("startUsagePolling", () => {
  it("refreshes immediately and every minute only while the dashboard is visible", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const refresh = vi.fn(async () => undefined);
    const stop = startUsagePolling(refresh);

    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);

    visibility.mockReturnValue("hidden");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
    vi.useRealTimers();
  });
});
