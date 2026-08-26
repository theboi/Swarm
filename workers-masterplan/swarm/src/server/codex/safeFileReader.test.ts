import { mkdtemp, mkdir, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readWorkspaceMarkdown } from "./safeFileReader.js";

let directory: string | undefined;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function workspace() {
  directory = await mkdtemp(join(tmpdir(), "swarm-safe-file-"));
  const root = join(directory, "EdenMind");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", "guide.md"), "placeholder");
  return root;
}

describe("readWorkspaceMarkdown", () => {
  it("realpath-confines a Markdown read and decodes the app-server base64 response", async () => {
    const root = await workspace();
    const readFile = vi.fn(async () => ({ dataBase64: Buffer.from("# Guide\n", "utf8").toString("base64") }));
    const expectedPath = await realpath(join(root, "docs", "guide.md"));

    await expect(readWorkspaceMarkdown({ account: "bot1", requestedPath: "docs/guide.md", workspaceRoot: root, appServer: { readFile } })).resolves.toEqual({
      path: expectedPath,
      filename: "guide.md",
      text: "# Guide\n",
    });
    expect(readFile).toHaveBeenCalledWith(expectedPath);
  });

  it("rejects traversal, another account home, symlink escapes, and non-Markdown extensions before app-server file access", async () => {
    const root = await workspace();
    const outside = join(directory!, "outside.md");
    await writeFile(outside, "outside");
    await symlink(outside, join(root, "docs", "escape.md"));
    await writeFile(join(root, "docs", "image.png"), "not markdown");
    const readFile = vi.fn(async () => ({ dataBase64: "" }));
    const input = { account: "bot1" as const, workspaceRoot: root, appServer: { readFile } };

    await expect(readWorkspaceMarkdown({ ...input, requestedPath: "../outside.md" })).rejects.toThrow(/outside workspace/i);
    await expect(readWorkspaceMarkdown({ ...input, requestedPath: "/Users/bot2/Dev/EdenMind/secret.md" })).rejects.toThrow(/outside workspace/i);
    await expect(readWorkspaceMarkdown({ ...input, requestedPath: "docs/escape.md" })).rejects.toThrow(/outside workspace/i);
    await expect(readWorkspaceMarkdown({ ...input, requestedPath: "docs/image.png" })).rejects.toThrow(/Markdown/i);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("fails closed on malformed base64 or content larger than two MiB", async () => {
    const root = await workspace();
    const malformed = vi.fn(async () => ({ dataBase64: "not base64!" }));
    await expect(readWorkspaceMarkdown({ account: "bot1", requestedPath: "docs/guide.md", workspaceRoot: root, appServer: { readFile: malformed } })).rejects.toThrow(/base64/i);

    const tooLarge = vi.fn(async () => ({ dataBase64: Buffer.alloc((2 * 1024 * 1024) + 1, "a").toString("base64") }));
    await expect(readWorkspaceMarkdown({ account: "bot1", requestedPath: "docs/guide.md", workspaceRoot: root, appServer: { readFile: tooLarge } })).rejects.toThrow(/two MiB/i);
  });

  it("rejects a pathname whose realpath changes while the app-server read is in flight", async () => {
    const root = await workspace();
    const target = join(root, "docs", "guide.md");
    const outside = join(directory!, "outside.md");
    await writeFile(outside, "outside");
    const readFile = vi.fn(async () => {
      await unlink(target);
      await symlink(outside, target);
      return { dataBase64: Buffer.from("outside", "utf8").toString("base64") };
    });

    await expect(readWorkspaceMarkdown({ account: "bot1", requestedPath: "docs/guide.md", workspaceRoot: root, appServer: { readFile } })).rejects.toThrow(/outside workspace|changed/i);
  });
});
