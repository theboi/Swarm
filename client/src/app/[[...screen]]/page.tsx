import { SwarmApp } from "../SwarmApp";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ screen: [] }, ...["home", "accounts", "todos", "chats", "settings"].map((screen) => ({ screen: [screen] })), { screen: ["settings", "appearance"] }];
}

export default function SwarmPage() {
  return <SwarmApp />;
}
