import { describe, expect, it } from "vitest";

import { markdownPath, parseAppRoute } from "./navigation.js";

describe("navigation", () => {
  it.each([
    ["/home", "", "home"],
    ["/accounts", "", "accounts"],
    ["/flowchart", "", "flowchart"],
    ["/chats", "?open=docs%2Frunbook.md", "chats"],
    ["/", "", "home"],
    ["/unknown", "", "home"],
  ] as const)("maps %s%s", (pathname, search, page) => {
    expect(parseAppRoute({ pathname, search })).toEqual(expect.objectContaining({ page }));
  });

  it("retains a Chats Markdown path and encodes its canonical URL", () => {
    expect(parseAppRoute({ pathname: "/chats", search: "?open=docs%2Frunbook.md" }).openMarkdownPath).toBe("docs/runbook.md");
    expect(markdownPath("docs/runbook.md")).toBe("/chats?open=docs%2Frunbook.md");
  });
});
