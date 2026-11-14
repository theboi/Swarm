import { ListTodo, House, MessagesSquare, UsersRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import "../styles.css";
import { pagePath } from "../navigation.js";

export type AppPage = "home" | "queued-tasks" | "chats" | "accounts";

const navigation = [
  { id: "home" as const, label: "Home", icon: House },
  { id: "accounts" as const, label: "Accounts", icon: UsersRound },
  { id: "queued-tasks" as const, label: "Queued tasks", icon: ListTodo },
  { id: "chats" as const, label: "Chats", icon: MessagesSquare },
];

function viewportVariant(width: number): "desktop" | "tablet" | "mobile" {
  if (width <= 767) return "mobile";
  if (width === 768) return "tablet";
  return "desktop";
}

export function AppShell({ activePage, hasBreakingChangeNotification = false, onNavigate, children }: { activePage: AppPage; hasBreakingChangeNotification?: boolean; onNavigate: (page: AppPage) => void; children: ReactNode }) {
  const [variant, setVariant] = useState(() => viewportVariant(window.innerWidth));
  const [composerFocused, setComposerFocused] = useState(false);
  const composing = variant === "mobile" && activePage === "chats" && composerFocused;

  useEffect(() => {
    const update = () => setVariant(viewportVariant(window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className={`app-shell app-shell--${variant}${composing ? " app-shell--composing" : ""}`} data-testid="app-shell" style={{ backgroundColor: "#15191b" }}
      onFocusCapture={(event) => setComposerFocused(event.target instanceof HTMLTextAreaElement)}
      onBlurCapture={(event) => setComposerFocused(event.relatedTarget instanceof HTMLTextAreaElement)}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="app-nav" aria-label="Primary navigation" data-variant={variant} hidden={composing}>
        <div className="app-nav__brand" aria-label="EdenMind Swarm">ES</div>
        {navigation.map(({ id, label, icon: Icon }) => (
          <a className="app-nav__item" key={id} href={pagePath(id)} aria-current={activePage === id ? "page" : undefined} aria-label={id === "chats" && hasBreakingChangeNotification ? "Chats — breaking change notification" : label} title={label} onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigate(id);
          }} style={{ minWidth: 44, minHeight: 44, textDecoration: "none" }}>
            <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
            {variant === "mobile" ? <span className="app-nav__label">{label}</span> : null}
            {id === "chats" && hasBreakingChangeNotification ? <span className="notification-dot" role="img" aria-label="Breaking change notification" /> : null}
          </a>
        ))}
      </nav>
      <main id="main-content" className="app-main">{children}</main>
    </div>
  );
}
