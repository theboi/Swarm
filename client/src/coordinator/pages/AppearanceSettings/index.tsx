import { EdenCard } from "@/components/primitives/EdenCard";
import { EdenCardButton } from "@/components/primitives/EdenCardButton";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import { SettingsLayout } from "@/eden-settings";
import { useAppearance } from "../../components/AppearanceProvider";
import { SettingsNavigation } from "./SettingsNavigation";
import styles from "./styles.module.scss";

export function AppearanceSettings({ onNavigate }: { onNavigate: () => void }) {
  const { theme, setTheme } = useAppearance();
  return <SettingsLayout sections={[]} navigation={<SettingsNavigation onNavigate={onNavigate} />}>
    <div className={styles.content}>
      <EdenCard asChild><section aria-label="Color theme" className={styles.card}>
        <h2>Color theme</h2>
        <div role="group" aria-label="Color theme choices" className={styles.options}>
          {(["dark", "light"] as const).map((choice) => <EdenCardButton asChild key={choice}>
            <button type="button" className={styles.option} aria-pressed={theme === choice} onClick={() => setTheme(choice)}>
              <span aria-hidden="true" className={`${styles.preview} ${styles[choice]}`} />
              <strong>{choice === "dark" ? "Dark" : "Light"}</strong>
              <span aria-hidden="true" className={styles.selection}>{theme === choice ? <EdenIcon name="check" size={16} /> : null}</span>
            </button>
          </EdenCardButton>)}
        </div>
      </section></EdenCard>
    </div>
  </SettingsLayout>;
}
