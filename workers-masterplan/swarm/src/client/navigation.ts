import type { AppPage } from "./components/AppShell.js";
import { ACCOUNT_IDS, type AccountId } from "../shared/contracts.js";

export interface AppRoute {
  page: AppPage;
  openFilePath: string | null;
  fileAccountId: AccountId | null;
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

export function filePath(path: string, accountId?: AccountId | null): string {
  return `/?${new URLSearchParams({ file: path, ...(accountId ? { account: accountId } : {}) }).toString()}`;
}

export function parseAppRoute({ pathname, search }: Pick<Location, "pathname" | "search">): AppRoute {
  const params = new URLSearchParams(search);
  const openFilePath = params.get("file") ?? (pathname === "/chats" ? params.get("open") : null);
  const requestedAccount = params.get("account");
  const fileAccountId = requestedAccount && ACCOUNT_IDS.includes(requestedAccount as AccountId) ? requestedAccount as AccountId : null;
  const page = openFilePath ? "chats" : (Object.entries(paths).find(([, path]) => path === pathname)?.[0] as AppPage | undefined) ?? "home";
  const canonicalPath = openFilePath ? filePath(openFilePath, fileAccountId) : pagePath(page);
  return { page, openFilePath, fileAccountId, canonicalPath };
}
