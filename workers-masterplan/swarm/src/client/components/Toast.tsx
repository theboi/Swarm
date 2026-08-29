import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Toast({ children, tone = "status", onDismiss }: { children: ReactNode; tone?: "status" | "error"; onDismiss?: () => void }) {
  return <div className={`app-toast app-toast--${tone}`} role={tone === "error" ? "alert" : "status"}><span>{children}</span>{onDismiss ? <button type="button" aria-label="Dismiss notification" title="Dismiss notification" onClick={onDismiss}><X aria-hidden="true" size={15} /></button> : null}</div>;
}
