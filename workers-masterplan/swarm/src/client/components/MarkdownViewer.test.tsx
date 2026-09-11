import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownViewer } from "./MarkdownViewer";

afterEach(cleanup);

describe("MarkdownViewer", () => {
  it("sanitizes rendered Markdown, focuses its Close control, and closes by keyboard", async () => {
    const user = userEvent.setup();
    let closed = false;
    render(<MarkdownViewer document={{ filename: "review.md", content: "# Review\n\n<script>window.evil = true</script>" }} onClose={() => { closed = true; }} />);

    const viewer = screen.getByRole("dialog", { name: "review.md" });
    expect(screen.getByRole("heading", { name: "Review" })).toBeVisible();
    expect(viewer.querySelector("script")).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(closed).toBe(true);
  });

  it("shows a non-Markdown file as wrapped plain text instead of parsing it as Markdown", () => {
    render(<MarkdownViewer document={{ filename: "app.ts", content: "const heading = '# not Markdown';" }} onClose={() => undefined} />);

    const viewer = screen.getByRole("dialog", { name: "app.ts" });
    expect(viewer.querySelector("pre")).toHaveTextContent("const heading = '# not Markdown';");
    expect(viewer.querySelector("h1")).toBeNull();
  });
});
