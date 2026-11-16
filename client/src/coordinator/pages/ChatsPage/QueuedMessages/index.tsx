import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import {
  removeMessage,
  retryMessage,
  useMessageQueue,
} from "../messageQueue.js";
import styles from "./styles.module.scss";

export function QueuedMessages({
  accountId,
  threadId,
}: {
  accountId: string | null;
  threadId: string | null;
}) {
  const messages = useMessageQueue().filter(
    (message) =>
      message.accountId === accountId && message.threadId === threadId,
  );
  if (!messages.length) return null;
  return (
    <ol className={styles.queue} aria-label="Queued messages">
      {messages.map((message) => (
        <li
          key={message.id}
          className={styles.row}
          aria-busy={message.state === "sending"}
        >
          <div>
            <p>{message.text}</p>
            {message.error ? (
              <span role="alert">{message.error}</span>
            ) : message.state === "sending" ? (
              <span role="status">Sending…</span>
            ) : null}
          </div>
          {message.state === "failed" ? (
            <EdenButton
              type="button"
              density="superCompact"
              appearance="borderless"
              isFloating={false}
              aria-label="Retry queued message"
              title="Retry"
              onClick={() => retryMessage(message.id)}
            >
              <EdenIcon name="rotateCw" size={14} />
            </EdenButton>
          ) : null}
          <EdenButton
            type="button"
            density="superCompact"
            appearance="borderless"
            isFloating={false}
            aria-label="Remove queued message"
            title="Remove"
            disabled={message.state === "sending"}
            onClick={() => removeMessage(message.id)}
          >
            <EdenIcon name="x" size={14} />
          </EdenButton>
        </li>
      ))}
    </ol>
  );
}
