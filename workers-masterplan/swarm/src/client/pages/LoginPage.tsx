import { useState, type FormEvent } from "react";

import type { CoordinatorApi } from "../api.js";
import { Toast } from "../components/Toast.js";

const genericError = "Unable to sign in. Check your details and try again.";
const invalidCodeError = "That authentication code couldn't be verified. Refresh the page to start again.";
const throttledError = "Too many sign-in attempts. Wait up to one hour before trying again.";

export function LoginPage({ api, onAuthenticated }: { api: Pick<CoordinatorApi, "startLogin" | "completeLogin">; onAuthenticated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const start = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError(null);
    try {
      const result = await api.startLogin({ email, password });
      if ("error" in result && result.error) return setError(result.error.code === "AUTH_THROTTLED" ? throttledError : genericError);
      setChallengeId(result.data.challengeId);
    } catch {
      setError(genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const complete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challengeId) return;
    setSubmitting(true); setError(null);
    try {
      const result = await api.completeLogin({ challengeId, code });
      if ("error" in result && result.error) return setError(result.error.code === "AUTH_THROTTLED" ? throttledError : invalidCodeError);
      if (!result.data.authenticated) return setError(invalidCodeError);
      onAuthenticated();
    } catch {
      setError(genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page" aria-labelledby="login-title">
      <section className="login-card">
        <p className="eyebrow">EdenMind Swarm</p><h1 id="login-title">Sign in</h1><p>Use your coordinator account to continue.</p>
        {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
        {challengeId ? (
          <form onSubmit={complete}>
            <label htmlFor="totp-code">Authentication code</label>
            <input id="totp-code" name="code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" required />
            <button className="primary-button" type="submit" disabled={submitting}>Sign in</button>
          </form>
        ) : (
          <form onSubmit={start}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            <button className="primary-button" type="submit" disabled={submitting}>Continue</button>
          </form>
        )}
      </section>
    </main>
  );
}
