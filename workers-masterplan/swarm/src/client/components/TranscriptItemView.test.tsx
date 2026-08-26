import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TranscriptItemView } from "./TranscriptItemView";

describe("TranscriptItemView", () => {
  it("retains a safe serialized payload when specialized transcript content is absent", () => {
    render(<TranscriptItemView item={{ id: "image-only", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "userMessage", status: null, createdAt: null, payload: { content: [{ type: "image", assetId: "asset-1" }] } }} onOpenMarkdown={() => undefined} />);

    expect(screen.getByRole("article", { name: "userMessage" })).toHaveTextContent('"assetId":"asset-1"');
  });
});
