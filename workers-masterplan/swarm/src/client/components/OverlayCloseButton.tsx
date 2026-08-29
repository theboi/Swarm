import { forwardRef } from "react";
import { X } from "lucide-react";

export const OverlayCloseButton = forwardRef<HTMLButtonElement, { onClick: () => void; disabled?: boolean }>(function OverlayCloseButton({ onClick, disabled = false }, ref) {
  return <button ref={ref} className="icon-button overlay-close-button" type="button" aria-label="Close" title="Close" disabled={disabled} onClick={onClick}><X aria-hidden="true" size={18} /></button>;
});
