import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import styles from "./styles.module.scss";

export function SettingsNavigation({ onNavigate }: { onNavigate: () => void }) {
  return <nav aria-label="Settings sections" className={styles.navigation}>
    <div className={styles.group}>
      <p>Settings</p>
      <a href="/settings/appearance" aria-current="page" className={styles.link} onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate();
      }}><EdenIcon name="sun" size={18} aria-hidden="true" /><span>Appearance</span></a>
    </div>
  </nav>;
}
