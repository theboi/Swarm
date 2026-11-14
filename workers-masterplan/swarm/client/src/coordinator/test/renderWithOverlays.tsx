import { EdenOverlayProvider } from "@/components/overlay/EdenOverlayProvider";
import { render as renderComponent } from "@testing-library/react";

export function renderWithOverlays(ui: React.ReactNode) {
  return renderComponent(ui, { wrapper: EdenOverlayProvider });
}
