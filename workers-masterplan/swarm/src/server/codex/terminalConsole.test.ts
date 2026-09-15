import { describe, expect, it } from "vitest";

import { codexLoginCommand, tmuxAttachCommand, tmuxServerCommand } from "./terminalConsole.js";

describe("terminal console commands", () => {
  it("uses an allowlisted account session for the app-server and its attach console", () => {
    const command = tmuxServerCommand("bot1", "'/opt/homebrew/bin/codex' app-server");

    expect(command).toContain("kill-session -t swarm-bot1");
    expect(command).toContain("new-session -d -s swarm-bot1");
    expect(command).toContain("trap ");
    expect(command).toContain("has-session -t swarm-bot1");
    expect(command).toContain("child=$!");
    expect(command).toContain('/bin/kill -TERM "$child"');
    expect(tmuxAttachCommand("bot1")).toContain("/usr/bin/su - bot1 -c");
  });

  it("opens Codex login as the selected bot instead of passing credentials through the browser", () => {
    const command = codexLoginCommand("bot1", "/opt/homebrew/bin/codex");

    expect(command).toContain("/usr/bin/su - bot1 -c");
    expect(command).toContain("/opt/homebrew/bin/codex");
    expect(command).toContain(" login");
    expect(command).not.toMatch(/password|token/i);
  });

  it("opens profile login as the owning bot with the profile's explicit CODEX_HOME", () => {
    const command = codexLoginCommand({ id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, codexHome: "/Users/bot1/.swarm/codex-profiles/acc2", workspaceRoot: "/Users/bot1/Dev/EdenMind-acc2" }, "/opt/homebrew/bin/codex");

    expect(command).toContain("/usr/bin/su - bot1 -c");
    expect(command).toContain("CODEX_HOME=");
    expect(command).toContain("/Users/bot1/.swarm/codex-profiles/acc2");
    expect(command).toContain(" login");
    expect(command).not.toMatch(/password|token/i);
  });

  it("uses direct local tmux and Codex login commands for claudiothe", () => {
    expect(tmuxAttachCommand("claudiothe")).toBe("exec '/opt/homebrew/bin/tmux' attach-session -t swarm-claudiothe");
    expect(codexLoginCommand("claudiothe", "/opt/homebrew/bin/codex")).toBe("exec '/opt/homebrew/bin/codex' login");
  });

  it("quotes the Codex binary inside the bot su command", () => {
    const command = codexLoginCommand("bot1", "/opt/homebrew/bin/codex; touch /tmp/pwned");

    expect(command).toBe(String.raw`exec /usr/bin/su - bot1 -c 'exec '\''/opt/homebrew/bin/codex; touch /tmp/pwned'\'' login'`);
  });
});
