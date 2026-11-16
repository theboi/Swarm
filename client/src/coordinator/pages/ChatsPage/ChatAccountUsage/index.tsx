import { useId, useState } from "react";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import type { AccountSnapshot } from "../../../../shared/contracts.js";
import { AccountUsageBar } from "../../../components/AccountSummaryPanel.js";
import { RateLimitBar } from "../../../components/RateLimitBar.js";
import { remainingPercent } from "../../../usage.js";
import styles from "./styles.module.scss";

export function ChatAccountUsage({ account }: { account: AccountSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const fiveHour = account.rateLimits.find(window => /five|primary/i.test(window.label) || /five|primary/i.test(window.id));
  const weekly = account.rateLimits.find(window => /week|secondary/i.test(window.label) || /week|secondary/i.test(window.id));
  return <footer className={`thread-picker__usage ${styles.footer}`}>
    <EdenButton density="superCompact" appearance="borderless" isFloating={false} className={styles.toggle} aria-label={`Usage limits for ${account.id}`} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <span className={styles.summary}>{expanded ? account.id : <AccountUsageBar account={account} showLabels />}</span>
      <EdenIcon name={expanded ? "chevronDown" : "chevronUp"} size={16} aria-hidden="true" />
    </EdenButton>
    {expanded ? <div id={id} className={styles.details}>
      <RateLimitBar density="compact" label="Five-hour" window={fiveHour} forceEmpty={remainingPercent(weekly) === 0} />
      <RateLimitBar density="compact" label="Weekly" window={weekly} />
    </div> : null}
  </footer>;
}
