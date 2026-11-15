import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranscriptItem } from "../../shared/contracts.js";
import { TranscriptTurns, reconcileTranscript } from "./TranscriptTurns.js";

afterEach(cleanup);
const openFile = () => undefined;
const item = (id: string, type: string, text: string, extra: Partial<TranscriptItem> = {}): TranscriptItem => ({ id, type, accountId: "bot3", threadId: "thread-1", turnId: "turn-1", status: "completed", createdAt: null, payload: { text }, ...extra });
const turn = [
  item("prompt", "userMessage", "Original request"),
  item("progress", "agentMessage", "Progress update", { payload: { text: "Progress update", phase: "commentary" } }),
  item("tool", "commandExecution", "Expensive output"),
  item("steer", "userMessage", "Please keep the steers"),
  item("final", "agentMessage", "Final answer", { payload: { text: "Final answer", phase: "final_answer" } }),
];

describe("TranscriptTurns", () => {
  it("keeps all user messages visible while disclosing intermediate activity", () => {
    render(<TranscriptTurns items={turn} onOpenMarkdown={openFile} />);
    expect(screen.getByText("Original request")).toBeVisible();
    expect(screen.queryByText("Progress update")).not.toBeInTheDocument();
    expect(screen.queryByText("Expensive output")).not.toBeInTheDocument();
    expect(screen.getByText("Please keep the steers")).toBeVisible();
    expect(screen.getByText("Final answer")).toBeVisible();
    const toggle = screen.getByRole("button", { name: /Show turn details/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText("Original request")).toBeVisible();
    expect(screen.getByText("Progress update")).toBeVisible();
    expect(screen.getAllByText("Please keep the steers")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Hide turn details/ }));
    expect(screen.getByText("Original request")).toBeVisible();
  });

  it("keeps earlier Codex questions and the user's answers outside turn details", () => {
    const question = item("question", "agentMessage", "Which option should I use?", { payload: { text: "Which option should I use?", phase: "final_answer" } });
    render(<TranscriptTurns items={[turn[0], question, turn[3], turn[1], turn[4]]} onOpenMarkdown={openFile} />);
    expect(screen.getByText("Which option should I use?")).toBeVisible();
    expect(screen.getByText("Original request")).toBeVisible();
    expect(screen.getByText("Please keep the steers")).toBeVisible();
    expect(screen.queryByText("Progress update")).not.toBeInTheDocument();
  });

  it("leaves a live final response expanded until it finishes, then collapses automatically", () => {
    const live = turn.map((entry) => entry.id === "final" ? { ...entry, status: "inProgress" } : entry);
    const view = render(<TranscriptTurns items={live} onOpenMarkdown={openFile} />);
    expect(screen.getByText("Original request")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Show turn details/ })).not.toBeInTheDocument();
    view.rerender(<TranscriptTurns items={turn} onOpenMarkdown={openFile} />);
    expect(screen.getByText("Original request")).toBeVisible();
  });

  it("uses authoritative turn completion for older messages without phase metadata", () => {
    const completed = turn.map((entry) => ({ ...entry, turnStatus: "completed" as const, payload: { text: entry.id } }));
    render(<TranscriptTurns items={completed} onOpenMarkdown={openFile} />);
    expect(screen.getByText("prompt", { selector: ".transcript-item__markdown p" })).toBeVisible();
    expect(screen.getByText("steer")).toBeVisible();
    expect(screen.getByText("final")).toBeVisible();
  });

  it("does not treat commentary, failed turns or unknown turn IDs as finished groups", () => {
    for (const entries of [turn.slice(0, 4), turn.map((entry) => ({ ...entry, turnStatus: "failed" as const })), turn.map((entry) => ({ ...entry, turnId: null }))]) {
      const view = render(<TranscriptTurns items={entries} onOpenMarkdown={openFile} />);
      expect(screen.getByText("Original request")).toBeVisible();
      expect(screen.queryByRole("button", { name: /Show turn details/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("keeps whole turn boundaries when windowing a long history", () => {
    const entries = Array.from({ length: 120 }, (_, index) => item(`step-${index}`, index === 0 ? "userMessage" : "commandExecution", `Step ${index}`));
    render(<TranscriptTurns items={[...entries, turn[3], turn[4]]} onOpenMarkdown={openFile} />);
    expect(screen.getByText("Step 0")).toBeVisible();
    expect(screen.getByText("Please keep the steers")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Show turn details/ }));
    expect(screen.getByText("Step 0")).toBeVisible();
  });

  it("does not render transcript children when a parent rerenders with the same data", () => {
    const readText = vi.fn(() => "Final answer");
    const entries = turn.map((entry) => entry.id === "final" ? { ...entry, payload: { phase: "final_answer", get text() { return readText(); } } } : entry);
    const view = render(<TranscriptTurns items={entries} onOpenMarkdown={openFile} />);
    const reads = readText.mock.calls.length;
    expect(reads).toBeGreaterThan(0);
    view.rerender(<TranscriptTurns items={entries} onOpenMarkdown={openFile} />);
    expect(readText).toHaveBeenCalledTimes(reads);
  });
});

describe("reconcileTranscript", () => {
  it("reuses unchanged entries and the whole array across JSON round trips", () => {
    expect(reconcileTranscript(turn, JSON.parse(JSON.stringify(turn)))).toBe(turn);
    const changed = JSON.parse(JSON.stringify(turn));
    changed[4].payload.text = "Updated answer";
    const next = reconcileTranscript(turn, changed);
    expect(next[0]).toBe(turn[0]);
    expect(next[4]).not.toBe(turn[4]);
    expect(next[4].payload.text).toBe("Updated answer");
  });
});
