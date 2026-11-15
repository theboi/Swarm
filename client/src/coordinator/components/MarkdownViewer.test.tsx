import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownViewer } from "./MarkdownViewer";
import { EdenOverlayProvider } from "@/components/overlay/EdenOverlayProvider";
import { useEdenModal } from "@/components/overlay/EdenOverlayProvider/useEdenModal";
import type { MarkdownDocument } from "../api";

function FilePreview({ document, onClose }: { document: MarkdownDocument; onClose: () => void }) {
  const { modal } = useEdenModal({ title: document.filename, defaultOpen: true, onClose, content: <MarkdownViewer document={document} /> });
  return modal;
}

afterEach(cleanup);

describe("MarkdownViewer", () => {
  it("sanitizes rendered Markdown, focuses its Close control, and closes by keyboard", async () => {
    const user = userEvent.setup();
    let closed = false;
    render(<FilePreview document={{ filename: "review.md", content: "# Review\n\n<script>window.evil = true</script>" }} onClose={() => { closed = true; }} />, { wrapper: EdenOverlayProvider });

    const viewer = screen.getByRole("dialog", { name: "review.md" });
    expect(screen.getByRole("heading", { name: "Review" })).toBeVisible();
    expect(viewer.querySelector("script")).toBeNull();
    expect(viewer).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    expect(closed).toBe(true);
  });

  it("shows a non-Markdown file as wrapped plain text instead of parsing it as Markdown", () => {
    render(<FilePreview document={{ filename: "app.ts", content: "const heading = '# not Markdown';" }} onClose={() => undefined} />, { wrapper: EdenOverlayProvider });

    const viewer = screen.getByRole("dialog", { name: "app.ts" });
    expect(viewer.querySelector("pre")).toHaveTextContent("const heading = '# not Markdown';");
    expect(viewer.querySelector("h1")).toBeNull();
  });
});
