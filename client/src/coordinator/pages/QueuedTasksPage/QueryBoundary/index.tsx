import { Component, Suspense } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";

class _QueryBoundary extends Component<{ children: React.ReactNode; retry: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div role="alert">{this.state.error.message} <EdenButton density="compact" appearance="secondary" isFloating={false} onClick={() => { this.props.retry(); this.setState({ error: null }); }}>Retry</EdenButton></div>;
  }
}
export function QueryBoundary({ children }: { children: React.ReactNode }) {
  return <QueryErrorResetBoundary>{({ reset }) => <_QueryBoundary retry={reset}><Suspense fallback={<div role="status">Loading…</div>}>{children}</Suspense></_QueryBoundary>}</QueryErrorResetBoundary>;
}
