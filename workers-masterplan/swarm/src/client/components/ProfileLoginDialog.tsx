import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { BotProfileAccountId } from "../../shared/contracts.js";
import type { ProfileLoginResponse } from "../api.js";

type ProfileLoginError = { code?: string; message: string };

function messageFor(error: ProfileLoginError): string {
  switch (error.code) {
    case "DESKTOP_APP_RUNNING": return "Close ChatGPT or Codex Desktop for this bot, then try again.";
    case "PROFILE_AUTH_ISOLATION_UNAVAILABLE": return "This profile cannot use an isolated credential store on this Mac.";
    case "LOGIN_EXPIRED": return "This sign-in code expired. Select Retry to start a new one.";
    case "IDENTITY_ALREADY_CONNECTED": return "That ChatGPT identity is already connected to another profile.";
    case "DEVICE_AUTH_UNAVAILABLE": return "Device sign-in is unavailable. Use browser sign-in or open a terminal.";
    default: return error.message || "Unable to start sign-in. Try again.";
  }
}

function resultOrThrow<T>(result: { data: T } | { error: ProfileLoginError }): T {
  if ("error" in result) throw result.error;
  return result.data;
}

function trapFocus(event: React.KeyboardEvent<HTMLElement>): void {
  if (event.key !== "Tab") return;
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

/** Device details are intentionally ephemeral React state; they are never persisted or sent back to the API. */
export function ProfileLoginDialog({ accountId, challenge: initialChallenge, onStart, onCancel, onClose, onRestoreFocus }: {
  accountId: BotProfileAccountId;
  challenge: ProfileLoginResponse;
  onStart: (accountId: BotProfileAccountId, method: ProfileLoginResponse["method"]) => Promise<{ data: ProfileLoginResponse } | { error: ProfileLoginError }>;
  onCancel: (accountId: BotProfileAccountId) => Promise<{ data: unknown } | { error: ProfileLoginError }>;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const [challenge, setChallenge] = useState(initialChallenge);
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState<"cancel" | "retry" | "browser" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expired = challenge.expiresAt <= now;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    dialog.current?.focus();
    const background = [...document.body.children].filter((element) => element !== backdrop.current);
    const prior = background.map((element) => ({ element, inert: element.hasAttribute("inert") }));
    for (const { element } of prior) element.setAttribute("inert", "");
    return () => {
      window.clearInterval(timer);
      for (const { element, inert } of prior) {
        if (!inert) element.removeAttribute("inert");
      }
      onRestoreFocus();
    };
  }, [onRestoreFocus]);

  const start = async (method: ProfileLoginResponse["method"], kind: "retry" | "browser") => {
    setPending(kind);
    setError(null);
    try {
      const next = resultOrThrow(await onStart(accountId, method));
      setChallenge(next);
      setNow(Date.now());
    } catch (cause) {
      const value = cause && typeof cause === "object" ? cause as ProfileLoginError : { message: "Unable to start sign-in." };
      setError(messageFor(value));
    } finally { setPending(null); }
  };
  const cancel = async () => {
    setPending("cancel");
    try { resultOrThrow(await onCancel(accountId)); }
    catch { /* Closing still removes the short-lived code from this browser. */ }
    finally { setPending(null); onClose(); }
  };
  const copy = async () => {
    if (!challenge.userCode || expired) return;
    setPending("copy");
    setError(null);
    try { await navigator.clipboard.writeText(challenge.userCode); }
    catch { setError("Unable to copy the sign-in code. Select and copy it manually."); }
    finally { setPending(null); }
  };

  return createPortal(
    <div className="dialog-backdrop profile-login-backdrop" ref={backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) void cancel(); }}>
      <section className="launch-dialog profile-login-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="profile-login-title" tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape" && !pending) { event.preventDefault(); void cancel(); } else trapFocus(event); }}>
        <header className="launch-dialog__header"><p className="eyebrow">Add account</p><h2 id="profile-login-title">Sign in to {accountId}</h2><p>Complete sign-in in the verification page, then return here.</p></header>
        {challenge.userCode ? <div className="profile-login-dialog__code"><span>Verification code</span><output aria-label="Verification code">{expired ? "Expired" : challenge.userCode}</output></div> : <p className="profile-login-dialog__browser">Browser sign-in is ready. Continue in the verification page.</p>}
        {expired ? <p role="alert">This sign-in code expired. Select Retry to start a new one.</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="dialog-actions profile-login-dialog__actions">
          <a className="account-card__action" href={challenge.verificationUrl} target="_blank" rel="noreferrer">Open verification page</a>
          <button type="button" onClick={() => void copy()} disabled={!challenge.userCode || expired || pending !== null}>{pending === "copy" ? "Copying…" : "Copy code"}</button>
          <button type="button" onClick={() => void start(challenge.method, "retry")} disabled={pending !== null}>{pending === "retry" ? "Retrying…" : "Retry"}</button>
          <button type="button" onClick={() => void start("same_mac_browser", "browser")} disabled={pending !== null}>{pending === "browser" ? "Starting browser sign-in…" : "Use browser sign-in"}</button>
          <button type="button" onClick={() => void cancel()} disabled={pending !== null}>Cancel</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
