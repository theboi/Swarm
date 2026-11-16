import { useEffect, useRef, useState } from "react";

import { EdenIcon, type IconName } from "@/components/primitives/EdenIcon/EdenIcon";
import { pagePath } from "../../navigation.js";
import type { AppPage } from "../AppShell";
import styles from "./styles.module.scss";

const NAVIGATION = [
  { id: "chats", label: "Chats", icon: "messagesSquare" },
  { id: "todos", label: "Todos", icon: "listTodo" },
  { id: "accounts", label: "Accounts", icon: "usersRound" },
  { id: "settings", label: "Settings", icon: "settings" },
] satisfies { id: AppPage; label: string; icon: IconName }[];

type Props = {
  activePage: AppPage;
  variant: "mobile" | "tablet" | "desktop";
  hidden: boolean;
  hasBreakingChangeNotification: boolean;
  onNavigate: (page: AppPage) => void;
};

// Swarm owns this copy of Eden's rail/bottom chrome; Eden navigation is untouched.
export function SwarmNavigation({ activePage, variant, hidden, hasBreakingChangeNotification, onNavigate }: Props) {
  const [openedOnPage, setOpenedOnPage] = useState<AppPage | null>(null);
  const root = useRef<HTMLElement>(null);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const mobile = variant === "mobile";
  const moreOpen = mobile && !hidden && openedOnPage === activePage;

  useEffect(() => {
    if (!moreOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpenedOnPage(null);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenedOnPage(null);
      moreTrigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [moreOpen]);

  function renderLink({ id, label, icon }: typeof NAVIGATION[number]) {
    const notification = id === "chats" && hasBreakingChangeNotification;
    return <a key={id} className={`${styles.link} ${mobile ? styles.tab : styles.railLink}`}
      href={pagePath(id)} aria-current={activePage === id ? "page" : undefined}
      aria-label={notification ? "Chats — breaking change notification" : label} title={label}
      style={{ minWidth: 44, minHeight: 44 }}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        setOpenedOnPage(null);
        onNavigate(id);
      }}>
      <EdenIcon name={icon} size={20} strokeWidth={1.75} aria-hidden="true" />
      {mobile ? <span>{label}</span> : null}
      {notification ? <span className={styles.notification} role="img" aria-label="Breaking change notification" /> : null}
    </a>;
  }

  return <nav ref={root} className={`app-nav ${mobile ? styles.bottom : styles.rail}`} aria-label="Primary navigation" data-variant={variant} hidden={hidden}>
    {mobile ? <>
      <div className={styles.row}>
        {NAVIGATION.slice(0, 3).map(renderLink)}
        <button ref={moreTrigger} type="button" className={`${styles.link} ${styles.tab}`}
          aria-label="More"
          aria-expanded={moreOpen} data-active={activePage === "settings" || undefined}
          onClick={() => setOpenedOnPage(moreOpen ? null : activePage)}>
          <EdenIcon name="moreHorizontal" size={20} aria-hidden="true" /><span>More</span>
        </button>
      </div>
      {moreOpen ? <div className={styles.more} aria-label="More destinations">{NAVIGATION.slice(3).map(renderLink)}</div> : null}
    </> : <>
      <div className={styles.brand} aria-label="Swarm"><EdenIcon name="network" size={28} aria-hidden="true" /></div>
      {NAVIGATION.slice(0, 3).map(renderLink)}
      <div className={styles.spacer} /><div className={styles.divider} />
      {NAVIGATION.slice(3).map(renderLink)}
    </>}
  </nav>;
}
