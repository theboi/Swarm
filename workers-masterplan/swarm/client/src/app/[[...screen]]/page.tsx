import { SwarmApp } from "../SwarmApp";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ screen: [] }, ...["home", "accounts", "queued-tasks", "chats"].map((screen) => ({ screen: [screen] }))];
}

export default function SwarmPage() {
  return <SwarmApp />;
}
