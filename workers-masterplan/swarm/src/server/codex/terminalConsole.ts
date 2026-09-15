import { isMacosBotId, LOCAL_ACCOUNT_ID, type AccountId, type CodexAccountSlot, type MacosBotId } from "../../shared/contracts.js";

const TMUX_BINARY = "/opt/homebrew/bin/tmux";

function shellQuote(value: string): string {
  if (!value || value.includes("\0") || value.includes("\n") || value.includes("\r")) throw new Error("Invalid terminal command value");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

type TerminalAccount = AccountId | CodexAccountSlot;

function accountId(account: TerminalAccount): AccountId {
  return typeof account === "object" ? account.id : account;
}

function macosUser(account: TerminalAccount): MacosBotId | undefined {
  if (typeof account === "object") return account.macosUser;
  return isMacosBotId(account) ? account : undefined;
}

export function tmuxSessionName(account: TerminalAccount): string {
  return `swarm-${accountId(account).replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

export function tmuxServerCommand(account: TerminalAccount, appServerCommand: string): string {
  const tmux = shellQuote(TMUX_BINARY);
  const session = tmuxSessionName(account);
  const stop = `${tmux} kill-session -t ${session} >/dev/null 2>&1 || true`;
  // Keep the command shell alive as the PTY process group's supervisor. When
  // the launcher closes that group, its trap tears down the detached tmux
  // server as well instead of leaving an orphaned app-server behind.
  return `${stop}; ${tmux} new-session -d -s ${session} ${appServerCommand}; trap ${shellQuote(stop)} EXIT HUP INT TERM; while ${tmux} has-session -t ${session} >/dev/null 2>&1; do /bin/sleep 1; done`;
}

export function tmuxAttachCommand(account: TerminalAccount): string {
  const command = `exec ${shellQuote(TMUX_BINARY)} attach-session -t ${tmuxSessionName(account)}`;
  if (accountId(account) === LOCAL_ACCOUNT_ID) return command;
  const owner = macosUser(account);
  if (!owner) throw new Error("A logical profile requires its owning macOS slot");
  return `exec /usr/bin/su - ${owner} -c ${shellQuote(command)}`;
}

export function codexLoginCommand(account: TerminalAccount, codexBin: string): string {
  if (!codexBin.startsWith("/") || codexBin.includes("\0")) throw new Error("Configured Codex binary must be an absolute path");
  const login = typeof account === "object"
    ? `/usr/bin/env CODEX_HOME=${shellQuote(account.codexHome)} ${shellQuote(codexBin)} login`
    : `${shellQuote(codexBin)} login`;
  const command = `exec ${login}`;
  if (accountId(account) === LOCAL_ACCOUNT_ID) return command;
  const owner = macosUser(account);
  if (!owner) throw new Error("A logical profile requires its owning macOS slot");
  return `exec /usr/bin/su - ${owner} -c ${shellQuote(command)}`;
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
