import { useEdenToast } from "@/components/overlay/EdenOverlayProvider/useEdenToast";
import type { ReactNode } from "react";

export function Toast({ children, tone = "status", onDismiss }: { children: ReactNode; tone?: "status" | "error"; onDismiss?: () => void }) {
  const { toast } = useEdenToast({
    defaultOpen: true,
    message: <span role={tone === "error" ? "alert" : undefined}>{children}</span>,
    appearance: tone === "error" ? "error" : "success",
    duration: tone === "error" ? Infinity : 4_500,
    onClose: onDismiss,
  });
  return toast;
}
