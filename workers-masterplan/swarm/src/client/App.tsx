import { useEffect, useState } from "react";

import type { CoordinatorApi } from "./api.js";
import { AppShell, type AppPage } from "./components/AppShell.js";
import { HomePage } from "./pages/HomePage.js";
import { FlowchartPage } from "./pages/FlowchartPage.js";
import { ChatsPage } from "./pages/ChatsPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { CoordinatorStoreProvider, useCoordinatorStore } from "./store/coordinatorStore.js";
import "./styles.css";

function Page({ page, api, onOpenChat, selectedThreadId }: { page: AppPage; api: CoordinatorApi; onOpenChat: (threadId: string) => void; selectedThreadId: string | null }) {
  const { snapshot, error, refresh } = useCoordinatorStore();
  const title = page === "home" ? "Home" : page === "flowchart" ? "Flowchart" : "Chats";
  if (page === "home" && snapshot) return <HomePage snapshot={snapshot} api={{ previewLaunch: api.previewLaunch, launch: api.launch }} />;
  if (page === "flowchart" && snapshot) return <FlowchartPage snapshot={snapshot} onOpenChat={onOpenChat} />;
  if (page === "chats" && snapshot) return <ChatsPage snapshot={snapshot} api={api} initialThreadId={selectedThreadId} onRefresh={refresh} />;
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">{title}</h1>
      {snapshot ? <p className="page-status">Coordinator snapshot updated.</p> : error ? <p role="alert" className="page-status">{error}</p> : <p role="status" className="page-status">Loading coordinator snapshot.</p>}
    </section>
  );
}

function AuthenticatedApp({ api }: { api: CoordinatorApi }) {
  const [page, setPage] = useState<AppPage>("home");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const openChat = (threadId: string) => { setSelectedThreadId(threadId); setPage("chats"); };
  return <AppShell activePage={page} onNavigate={setPage}><Page page={page} api={api} onOpenChat={openChat} selectedThreadId={selectedThreadId} /></AppShell>;
}

export function App({ api }: { api: CoordinatorApi }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    void api.getSession().then((session) => setAuthenticated(session.authenticated)).catch(() => setAuthenticated(false));
  }, [api]);

  if (authenticated === null) return <p role="status">Checking session.</p>;
  if (!authenticated) return <LoginPage api={api} onAuthenticated={() => setAuthenticated(true)} />;
  return <CoordinatorStoreProvider api={api}><AuthenticatedApp api={api} /></CoordinatorStoreProvider>;
}
