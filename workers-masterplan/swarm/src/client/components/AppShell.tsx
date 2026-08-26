import { ChartNoAxesCombined, House, MessagesSquare } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import "../styles.css";

export type AppPage = "home" | "flowchart" | "chats";

const navigation = [
  { id: "home" as const, label: "Home", icon: House },
  { id: "flowchart" as const, label: "Flowchart", icon: ChartNoAxesCombined },
  { id: "chats" as const, label: "Chats", icon: MessagesSquare },
];

function viewportVariant(width: number): "desktop" | "tablet" | "mobile" {
  if (width <= 767) return "mobile";
  if (width === 768) return "tablet";
  return "desktop";
}

export function AppShell({ activePage, onNavigate, children }: { activePage: AppPage; onNavigate: (page: AppPage) => void; children: ReactNode }) {
  const [variant, setVariant] = useState(() => viewportVariant(window.innerWidth));

  useEffect(() => {
    const update = () => setVariant(viewportVariant(window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className={`app-shell app-shell--${variant}`} data-testid="app-shell" style={{ backgroundColor: "#15191b" }}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="app-nav" aria-label="Primary navigation" data-variant={variant}>
        <div className="app-nav__brand" aria-label="EdenMind Swarm">ES</div>
        {navigation.map(({ id, label, icon: Icon }) => (
          <button className="app-nav__item" key={id} type="button" aria-current={activePage === id ? "page" : undefined} onClick={() => onNavigate(id)} style={{ minWidth: 44, minHeight: 44 }}>
            <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
            <span className="app-nav__label">{label}</span>
          </button>
        ))}
      </nav>
      <main id="main-content" className="app-main">{children}</main>
    </div>
  );
}
