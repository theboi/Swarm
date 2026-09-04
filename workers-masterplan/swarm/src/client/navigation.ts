import type { AppPage } from "./components/AppShell.js";

export interface AppRoute {
  page: AppPage;
  openMarkdownPath: string | null;
  canonicalPath: string;
}

const paths: Record<AppPage, string> = {
  home: "/home",
  accounts: "/accounts",
  flowchart: "/flowchart",
  chats: "/chats",
};

export function pagePath(page: AppPage): string {
  return paths[page];
}

export function markdownPath(path: string): string {
  return `/chats?${new URLSearchParams({ open: path }).toString()}`;
}

export function parseAppRoute({ pathname, search }: Pick<Location, "pathname" | "search">): AppRoute {
  const page = (Object.entries(paths).find(([, path]) => path === pathname)?.[0] as AppPage | undefined) ?? "home";
  const openMarkdownPath = page === "chats" ? new URLSearchParams(search).get("open") : null;
  const canonicalPath = page === "chats" && openMarkdownPath ? markdownPath(openMarkdownPath) : pagePath(page);
  return { page, openMarkdownPath, canonicalPath };
}
