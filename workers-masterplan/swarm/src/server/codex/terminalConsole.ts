import { LOCAL_ACCOUNT_ID, type AccountId } from "../../shared/contracts.js";

const TMUX_BINARY = "/opt/homebrew/bin/tmux";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function tmuxSessionName(account: AccountId): string {
  return `swarm-${account}`;
}

export function tmuxServerCommand(account: AccountId, appServerCommand: string): string {
  const tmux = shellQuote(TMUX_BINARY);
  const session = tmuxSessionName(account);
  return `${tmux} kill-session -t ${session} >/dev/null 2>&1 || true; exec ${tmux} new-session -s ${session} ${appServerCommand}`;
}

export function tmuxAttachCommand(account: AccountId): string {
  const command = `exec ${shellQuote(TMUX_BINARY)} attach-session -t ${tmuxSessionName(account)}`;
  return account === LOCAL_ACCOUNT_ID ? command : `exec /usr/bin/su - ${account} -c ${shellQuote(command)}`;
}

export function codexLoginCommand(account: AccountId, codexBin: string): string {
  if (!codexBin.startsWith("/") || codexBin.includes("\0")) throw new Error("Configured Codex binary must be an absolute path");
  const command = `exec ${shellQuote(codexBin)} login`;
  return account === LOCAL_ACCOUNT_ID ? command : `exec /usr/bin/su - ${account} -c ${shellQuote(command)}`;
}

const APPLESCRIPT = `on run argv
  tell application "Terminal"
    activate
    do script (item 1 of argv)
  end tell
end run`;

export async function openMacOsTerminal(command: string): Promise<void> {
  const { execFile } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    execFile("/usr/bin/osascript", ["-e", APPLESCRIPT, "--", command], { timeout: 5_000 }, (error) => error ? reject(error) : resolve());
  });
}
