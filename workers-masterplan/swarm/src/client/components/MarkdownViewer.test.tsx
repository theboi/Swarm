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
});
