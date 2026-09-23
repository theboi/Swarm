import { describe, expect, it } from "vitest";

import { filePath, parseAppRoute } from "./navigation.js";

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

  it("canonicalizes a legacy Chats Markdown path as a file query", () => {
    const route = parseAppRoute({ pathname: "/chats", search: "?open=docs%2Frunbook.md" });
    expect(route.openFilePath).toBe("docs/runbook.md");
    expect(route.canonicalPath).toBe("/?file=docs%2Frunbook.md");
    expect(filePath("docs/runbook.md", "bot3")).toBe("/?file=docs%2Frunbook.md&account=bot3");
  });

  it("opens a file query on the root URL in Chats with its owning account intact", () => {
    expect(parseAppRoute({ pathname: "/", search: "?file=src%2Fclient%2FApp.tsx&account=bot3" })).toEqual({
      page: "chats",
      openFilePath: "src/client/App.tsx",
      fileAccountId: "bot3",
      canonicalPath: "/?file=src%2Fclient%2FApp.tsx&account=bot3",
    });
  });

  it("preserves a validated logical profile account in a file query", () => {
    expect(parseAppRoute({ pathname: "/", search: "?file=src%2Fclient%2FApp.tsx&account=bot1%2Facc2" })).toEqual({
      page: "chats",
      openFilePath: "src/client/App.tsx",
      fileAccountId: "bot1/acc2",
      canonicalPath: "/?file=src%2Fclient%2FApp.tsx&account=bot1%2Facc2",
    });
  });
});
