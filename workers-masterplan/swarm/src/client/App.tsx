import { useCallback, useEffect, useState } from "react";

import type { CoordinatorApi } from "./api.js";
import { AppShell, type AppPage } from "./components/AppShell.js";
import { HomePage, type ChatTarget } from "./pages/HomePage.js";
import { AccountsPage } from "./pages/AccountsPage.js";
import { FlowchartPage } from "./pages/FlowchartPage.js";
import { ChatsPage } from "./pages/ChatsPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { CoordinatorStoreProvider, useCoordinatorStore } from "./store/coordinatorStore.js";
import { LOCAL_ACCOUNT_ID, type AccountId } from "../shared/contracts.js";
import { Toast } from "./components/Toast.js";
import { markdownPath, pagePath, parseAppRoute, type AppRoute } from "./navigation.js";

type ChatSelection = { accountId: AccountId; threadId?: string };
import "./styles.css";

function Page({ route, api, onOpenAccountChat, onOpenThread, onOpenLaunchedChat, selectedChat, onNavigate, onOpenMarkdownPathChange }: { route: AppRoute; api: CoordinatorApi; onOpenAccountChat: (accountId: AccountId) => void; onOpenThread: (threadId: string) => void; onOpenLaunchedChat: (target: ChatTarget) => void; selectedChat: ChatSelection | null; onNavigate: (page: AppPage) => void; onOpenMarkdownPathChange: (path: string | null) => void }) {
  const { snapshot, error, refresh, refreshUsage, transcriptRevision, activeTurnKeys, activeTurnIds, limitExhaustedTurnKeys, unreadTurnKeys, attentionTurnKeys, markTurnActive, markThreadRead } = useCoordinatorStore();
  const { page } = route;
  const title = page === "home" ? "Home" : page === "flowchart" ? "Flowchart" : page === "chats" ? "Chats" : "Accounts";
  if (page === "home" && snapshot) return <HomePage snapshot={snapshot} api={{ previewLaunch: api.previewLaunch, launch: api.launch, listModels: api.listModels }} onOpenAccountChat={onOpenAccountChat} onOpenChat={onOpenLaunchedChat} onViewAccounts={() => onNavigate("accounts")} onRefreshUsage={refreshUsage} />;
  if (page === "accounts" && snapshot) return <AccountsPage snapshot={snapshot} api={{ connectAccount: api.connectAccount, openTerminal: api.openTerminal, refreshAllRateLimits: api.refreshAllRateLimits }} onRefresh={refresh} onRefreshUsage={refreshUsage} onBack={() => onNavigate("home")} />;
  if (page === "flowchart" && snapshot) return <FlowchartPage snapshot={snapshot} api={{ previewLaunch: api.previewLaunch, launch: api.launch, listModels: api.listModels }} onOpenChat={onOpenThread} onOpenLaunchedChat={onOpenLaunchedChat} />;
  if (page === "chats" && snapshot) return <ChatsPage snapshot={snapshot} api={api} initialTarget={selectedChat?.threadId ? { accountId: selectedChat.accountId, threadId: selectedChat.threadId } : undefined} initialAccountId={route.openMarkdownPath ? LOCAL_ACCOUNT_ID : selectedChat?.accountId} openMarkdownPath={route.openMarkdownPath} onOpenMarkdownPathChange={onOpenMarkdownPathChange} transcriptRevision={transcriptRevision} activeTurnKeys={activeTurnKeys} activeTurnIds={activeTurnIds} limitExhaustedTurnKeys={limitExhaustedTurnKeys} unreadTurnKeys={unreadTurnKeys} attentionTurnKeys={attentionTurnKeys} markTurnActive={markTurnActive} markThreadRead={markThreadRead} onRefresh={refresh} />;
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">{title}</h1>
      {snapshot ? <p className="page-status">Coordinator snapshot updated.</p> : error ? <Toast tone="error">{error}</Toast> : <p role="status" className="page-status">Loading coordinator snapshot.</p>}
    </section>
  );
}

function AuthenticatedApp({ api }: { api: CoordinatorApi }) {
  const [route, setRoute] = useState(() => parseAppRoute(window.location));
  const [selectedChat, setSelectedChat] = useState<ChatSelection | null>(null);
  const { snapshot, refresh, markTurnActive } = useCoordinatorStore();
  const synchronizeRoute = useCallback(() => {
    const nextRoute = parseAppRoute(window.location);
    if (`${window.location.pathname}${window.location.search}` !== nextRoute.canonicalPath) window.history.replaceState(null, "", nextRoute.canonicalPath);
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    synchronizeRoute();
    window.addEventListener("popstate", synchronizeRoute);
    return () => window.removeEventListener("popstate", synchronizeRoute);
  }, [synchronizeRoute]);

  const navigate = useCallback((page: AppPage) => {
    window.history.pushState(null, "", pagePath(page));
    setRoute(parseAppRoute(window.location));
  }, []);

  const updateOpenMarkdownPath = useCallback((path: string | null) => {
    const nextPath = path ? markdownPath(path) : pagePath("chats");
    if (`${window.location.pathname}${window.location.search}` !== nextPath) window.history.pushState(null, "", nextPath);
    setRoute(parseAppRoute(window.location));
  }, []);

  const openThread = (threadId: string) => {
    const accountId = snapshot?.threads.find((thread) => thread.id === threadId)?.accountId;
    if (accountId) setSelectedChat({ accountId, threadId });
    navigate("chats");
  };
  const openLaunchedChat = (target: ChatTarget) => {
    markTurnActive(target.accountId, target.threadId);
    setSelectedChat(target);
    navigate("chats");
    void refresh();
  };
  const openAccountChat = (accountId: AccountId) => { setSelectedChat({ accountId }); navigate("chats"); };
  const hasBreakingChangeNotification = snapshot?.accounts.some((account) => account.hasBreakingChange) ?? false;
  return <AppShell activePage={route.page} hasBreakingChangeNotification={hasBreakingChangeNotification} onNavigate={navigate}><Page route={route} api={api} onOpenAccountChat={openAccountChat} onOpenThread={openThread} onOpenLaunchedChat={openLaunchedChat} selectedChat={selectedChat} onNavigate={navigate} onOpenMarkdownPathChange={updateOpenMarkdownPath} /></AppShell>;
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
