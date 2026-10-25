import type { AccountId, CoordinatorSnapshot, DispatchRecord } from "../../shared/contracts.js";
import type { CoordinatorApi } from "../api.js";
import { AccountSummaryPanel } from "../components/AccountSummaryPanel.js";

type HomeApi = Pick<CoordinatorApi, "previewLaunch" | "launch"> & Partial<Pick<CoordinatorApi, "listModels">>;
export type ChatTarget = Pick<DispatchRecord, "accountId" | "threadId">;

export function HomePage({ snapshot, api, activeTurnKeys = new Set(), unreadTurnKeys = new Set(), onOpenAccountChat, onOpenChat = () => undefined, onViewAccounts = () => undefined, onRefreshUsage }: { snapshot: CoordinatorSnapshot; api: HomeApi; activeTurnKeys?: ReadonlySet<string>; unreadTurnKeys?: ReadonlySet<string>; onOpenAccountChat?: (accountId: AccountId) => void; onOpenChat?: (target: ChatTarget) => void; onViewAccounts?: () => void; onRefreshUsage?: () => Promise<void> }) {
  return (
    <section className="home-page" aria-label="Home">
      <header><p className="eyebrow">Operating cockpit</p><h1>Home</h1></header>
      <div className="home-dashboard">
        <div className="home-work">
          <section aria-label="Attention queue"><h2>Attention queue</h2>{snapshot.pendingApprovals.length ? snapshot.pendingApprovals.map(approval => <article key={approval.id}><p>{approval.summary}</p><small>{approval.accountId} · {approval.method}</small></article>) : <p>No pending approvals reported.</p>}</section>
        </div>
        <AccountSummaryPanel accounts={snapshot.accounts} assignments={[]} tasks={[]} threads={snapshot.threads} limitResumes={snapshot.limitResumes} activeTurnKeys={activeTurnKeys} unreadTurnKeys={unreadTurnKeys} onOpenAccountChat={onOpenAccountChat} onViewMore={onViewAccounts} onRefreshUsage={onRefreshUsage} />
      </div>
    </section>
  );
}
