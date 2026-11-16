import { useEffect, useRef, useState, type ReactNode } from "react";

import "../styles.css";
import { SwarmNavigation } from "./SwarmNavigation";

export type AppPage = "todos" | "chats" | "accounts" | "settings";

function viewportVariant(width: number): "desktop" | "tablet" | "mobile" {
  if (width <= 767) return "mobile";
  if (width < 1280) return "tablet";
  return "desktop";
}

export function AppShell({ activePage, hasBreakingChangeNotification = false, onNavigate, children }: { activePage: AppPage; hasBreakingChangeNotification?: boolean; onNavigate: (page: AppPage) => void; children: ReactNode }) {
  const [variant, setVariant] = useState(() => viewportVariant(window.innerWidth));
  const [composerFocused, setComposerFocused] = useState(false);
  const pointerActive = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const composing = variant === "mobile" && activePage === "chats" && composerFocused;

  useEffect(() => {
    const reconcile = () => setComposerFocused(document.activeElement instanceof HTMLTextAreaElement);
    // Removing a focused textarea need not emit blur (Back, account changes, overlays).
    const observer = new MutationObserver(() => { if (!pointerActive.current) reconcile(); });
    if (shellRef.current) observer.observe(shellRef.current, { childList: true, subtree: true });
    window.addEventListener("focus", reconcile);
    const update = () => setVariant(viewportVariant(window.innerWidth));
    const finishPointer = () => {
      pointerActive.current = false;
      // Let the click finish before restoring navigation can move its target.
      window.setTimeout(() => setComposerFocused(document.activeElement instanceof HTMLTextAreaElement), 0);
    };
    window.addEventListener("resize", update);
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);
    return () => {
      observer.disconnect();
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("resize", update);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
    };
  }, []);

  return (
    <div ref={shellRef} className={`app-shell app-shell--${variant}${composing ? " app-shell--composing" : ""}`} data-testid="app-shell"
      onPointerDownCapture={() => { pointerActive.current = true; }}
      onFocusCapture={(event) => { if (!pointerActive.current || event.target instanceof HTMLTextAreaElement) setComposerFocused(event.target instanceof HTMLTextAreaElement); }}
      onBlurCapture={(event) => { if (!pointerActive.current) setComposerFocused(event.relatedTarget instanceof HTMLTextAreaElement); }}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SwarmNavigation activePage={activePage} variant={variant} hidden={composing} hasBreakingChangeNotification={hasBreakingChangeNotification} onNavigate={onNavigate} />
      <main id="main-content" className={`app-main${activePage === "settings" ? " app-main--settings" : ""}`}>{children}</main>
    </div>
  );
}
