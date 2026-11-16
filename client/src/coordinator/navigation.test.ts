import { describe, expect, it } from "vitest";

import { filePath, pagePath, parseAppRoute } from "./navigation.js";

describe("navigation", () => {
  it("retains selected list URLs on the canonical Todos destination", () => {
    expect(parseAppRoute({ pathname: "/todos", search: "?list=work%2Fnext" })).toMatchObject({ page: "todos", canonicalPath: "/todos?list=work%2Fnext" });
    expect(parseAppRoute({ pathname: "/queued-tasks", search: "" })).toMatchObject({ page: "chats", canonicalPath: "/chats" });
  });
  it("canonicalizes the trailing slash on a selected Todos list", () => {
    expect(parseAppRoute({ pathname: "/todos/", search: "?list=work" })).toMatchObject({ page: "todos", canonicalPath: "/todos?list=work" });
  });
  it("opens appearance settings and canonicalizes the settings entry", () => {
    expect(pagePath("settings")).toBe("/settings/appearance");
    expect(parseAppRoute({ pathname: "/settings/appearance", search: "" })).toMatchObject({ page: "settings", canonicalPath: "/settings/appearance" });
    expect(parseAppRoute({ pathname: "/settings", search: "" })).toMatchObject({ page: "settings", canonicalPath: "/settings/appearance" });
    expect(parseAppRoute({ pathname: "/settings/appearance/", search: "" })).toMatchObject({ page: "settings", canonicalPath: "/settings/appearance" });
  });
  it.each([
    ["/home", "", "chats"],
    ["/accounts", "", "accounts"],
    ["/todos", "", "todos"],
    ["/chats", "?open=docs%2Frunbook.md", "chats"],
    ["/", "", "chats"],
    ["/unknown", "", "chats"],
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
