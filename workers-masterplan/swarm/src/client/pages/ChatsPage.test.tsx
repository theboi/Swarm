import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { ChatsPage } from "./ChatsPage";
import { chatSnapshot, chatTranscript, setViewport } from "../test/fixtures";

afterEach(cleanup);

const api = {
  readTranscript: async () => ({ data: chatTranscript }),
  readMarkdown: async () => ({ data: { filename: "runbook.md", content: "# Runbook\n\n<script>window.evil = true</script>\n\nSafe coordinator instructions." } }),
  startTurn: async () => ({ data: {} }),
  startThread: async () => ({ data: chatSnapshot.threads[1] }),
  archiveThread: async () => ({ data: {} }),
  steerTurn: async () => ({ data: {} }),
  interruptTurn: async () => ({ data: {} }),
  decideApproval: async () => ({ data: {} }),
};

describe("ChatsPage", () => {
  it("groups chats by macOS account and toggles the selected bot3 picker only on a re-click", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    expect(screen.getByRole("button", { name: "bot3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "T0 · Graph planning" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "bot3" }));
    expect(screen.getByRole("button", { name: "T0 · Graph planning" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "bot3" }));
    expect(screen.queryByRole("button", { name: "T0 · Graph planning" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bot1" })).toBeVisible();
  });

  it("selects the owning account when Flowchart opens a mapped chat", async () => {
    setViewport(390);
    render(<ChatsPage snapshot={chatSnapshot} api={api} initialThreadId="thread-3" />);

    expect(screen.getByRole("button", { name: "bot1" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("heading", { name: "Account recovery" })).toBeVisible();
  });

  it("renders exact normalized transcript item categories and opens Markdown only from a transcript file link", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    for (const type of ["userMessage", "agentMessage", "plan", "reasoning", "commandExecution", "fileChange", "subAgentActivity", "opaque"]) {
      expect(await screen.findByRole("article", { name: type })).toBeVisible();
    }
    const transcript = screen.getByTestId("transcript-scroll");
    transcript.scrollTop = 144;
    await user.click(screen.getByRole("link", { name: "docs/runbook.md" }));
    const viewer = await screen.findByRole("dialog", { name: "runbook.md" });
    expect(viewer.querySelector("script")).toBeNull();
    expect(screen.getByRole("heading", { name: "Runbook" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: /Markdown preview/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "runbook.md" })).not.toBeInTheDocument();
    expect(transcript.scrollTop).toBe(144);
  });

  it("enables thread controls only for reported capabilities and reports each completed chat action", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    await screen.findByRole("article", { name: "userMessage" });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive chat" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Steer" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(await screen.findByRole("status")).toHaveTextContent("New chat created.");

    await user.click(screen.getByRole("button", { name: "bot3" }));
    await user.click(screen.getByRole("button", { name: "U1 · Coordinator UI" }));
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive chat" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Steer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeDisabled();
  });

  it("selects a server-created chat after the normalized snapshot refreshes", async () => {
    setViewport(390);
    const user = userEvent.setup();
    const createdThread = { id: "thread-4", accountId: "bot3" as const, name: "Follow-up", archived: false, updatedAt: 1_725_000_400, capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false } };
    function Harness() {
      const [currentSnapshot, setCurrentSnapshot] = useState(chatSnapshot);
      return <ChatsPage snapshot={currentSnapshot} api={{ ...api, startThread: async () => ({ data: createdThread }) }} onRefresh={async () => setCurrentSnapshot({ ...chatSnapshot, threads: [...chatSnapshot.threads, createdThread] })} />;
    }
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(await screen.findByRole("heading", { name: "Follow-up" })).toBeVisible();
  });

  it("shows only the normalized available decisions for a pending approval in the selected chat", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    expect(await screen.findByText("rm -rf /Users/bot4")).toBeVisible();
    expect(screen.getByRole("button", { name: "Decline approval" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve approval" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Decline approval" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Approval response sent.");
  });

  it("sends the exact requested turn permissions only after an explicit grant choice", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const requestedPermissions = { network: { enabled: true } };
    const approval = { ...chatSnapshot.pendingApprovals[0], method: "item/permissions/requestApproval", availableDecisions: ["grant_turn", "grant_turn_strict", "deny"], requestedPermissions };
    const decideApproval = vi.fn(async () => ({ data: {} }));
    render(<ChatsPage snapshot={{ ...chatSnapshot, pendingApprovals: [approval] }} api={{ ...api, decideApproval }} />);

    await user.click(await screen.findByRole("button", { name: "Grant requested turn permissions" }));

    expect(decideApproval).toHaveBeenCalledWith(approval, "grant_turn", requestedPermissions);
  });

  it("reports an unavailable open-terminal clipboard action instead of claiming success", async () => {
    setViewport(1440);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    const user = userEvent.setup();
    try {
      render(<ChatsPage snapshot={chatSnapshot} api={api} />);
      await user.click(screen.getByRole("button", { name: "Copy open-terminal command" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Unable to copy the open-terminal command.");
    } finally {
      writeText.mockRestore();
    }
  });
});
