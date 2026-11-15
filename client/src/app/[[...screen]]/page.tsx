import { SwarmApp } from "../SwarmApp";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ screen: [] }, ...["home", "accounts", "queued-tasks", "chats", "settings"].map((screen) => ({ screen: [screen] })), { screen: ["settings", "appearance"] }];
}

export default function SwarmPage() {
  return <SwarmApp />;
}
