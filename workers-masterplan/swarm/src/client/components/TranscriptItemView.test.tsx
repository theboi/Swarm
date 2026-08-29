import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";

import { TranscriptItemView } from "./TranscriptItemView";

afterEach(cleanup);

describe("TranscriptItemView", () => {
  it.each([
    ["userMessage", "You"],
    ["agentMessage", "Codex"],
    ["plan", "Plan"],
    ["reasoning", "Thinking"],
    ["commandExecution", "Command"],
    ["fileChange", "Files changed"],
    ["subAgentActivity", "Worker activity"],
    ["opaque", "Event"],
  ] as const)("gives %s a concise human-facing label", (type, label) => {
    render(<TranscriptItemView item={{ id: `${type}-1`, accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type, status: "completed", createdAt: null, payload: { text: "Details" } }} onOpenMarkdown={() => undefined} />);

    expect(screen.getByRole("article", { name: type })).toHaveTextContent(label);
  });

  it("retains a safe serialized payload when specialized transcript content is absent", () => {
    render(<TranscriptItemView item={{ id: "image-only", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "userMessage", status: null, createdAt: null, payload: { content: [{ type: "image", assetId: "asset-1" }] } }} onOpenMarkdown={() => undefined} />);

    expect(screen.getByRole("article", { name: "userMessage" })).toHaveTextContent('"assetId":"asset-1"');
  });

  it("collapses a long file-change list until the operator expands it", async () => {
    const user = userEvent.setup();
    const changes = Array.from({ length: 24 }, (_, index) => ({ path: `src/feature-${index}.ts`, kind: "update" }));
    render(<TranscriptItemView item={{ id: "files-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "fileChange", status: "completed", createdAt: null, payload: { changes } }} onOpenMarkdown={() => undefined} />);

    const list = document.getElementById("transcript-body-files-1");
    expect(list).toHaveClass("transcript-item__body--collapsed");
    await user.click(screen.getByRole("button", { name: "Expand Files changed" }));

    expect(list).not.toHaveClass("transcript-item__body--collapsed");
    expect(screen.getByRole("button", { name: "Collapse Files changed" })).toBeVisible();
  });

  it("marks a live reasoning summary as actively streaming", () => {
    render(<TranscriptItemView active item={{ id: "reasoning-live", accountId: "bot3", threadId: "thread-1", turnId: "turn-live", type: "reasoning", status: "inProgress", createdAt: null, payload: { summary: ["Checking the remote task evidence."] } }} onOpenMarkdown={() => undefined} />);

    expect(screen.getByRole("article", { name: "reasoning" })).toHaveTextContent("Checking the remote task evidence.");
    expect(screen.getByLabelText("Thinking in progress")).toBeVisible();
  });

  it("renders message text as sanitized Markdown and toggles one message to plain text", async () => {
    const user = userEvent.setup();
    render(<TranscriptItemView item={{ id: "agent-md", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "agentMessage", status: "completed", createdAt: null, payload: { text: "**Ready** with `code`." } }} onOpenMarkdown={() => undefined} />);

    expect(screen.getByText("Ready", { selector: ".transcript-item__markdown strong" })).toBeVisible();
    expect(screen.getByText("code", { selector: "code" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show plain text" }));
    expect(screen.getByText("**Ready** with `code`.", { selector: "pre" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Render Markdown" })).toBeVisible();
  });
});
