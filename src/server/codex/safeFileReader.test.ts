import { mkdtemp, mkdir, readFile as readNodeFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readAccountFile } from "./safeFileReader.js";
import type { CodexAccountSlot } from "../../shared/contracts.js";

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
  await writeFile(join(root, "src.ts"), "export const ready = true;\n");
  return root;
}

describe("readAccountFile", () => {
  it("resolves a Markdown read and decodes the app-server base64 response", async () => {
    const root = await workspace();
    const readFile = vi.fn(async () => ({ dataBase64: Buffer.from("# Guide\n", "utf8").toString("base64") }));
    const expectedPath = resolve(join(root, "docs", "guide.md"));

    await expect(readAccountFile({ account: "bot1", requestedPath: "docs/guide.md", workspaceRoot: root, appServer: { readFile } })).resolves.toEqual({
      path: expectedPath,
      filename: "guide.md",
      text: "# Guide\n",
    });
    expect(readFile).toHaveBeenCalledWith(expectedPath);
  });

  it("reads a non-Markdown workspace source file", async () => {
    const root = await workspace();
    const readFile = vi.fn(async () => ({ dataBase64: Buffer.from("export const ready = true;\n", "utf8").toString("base64") }));

    await expect(readAccountFile({ account: "bot1", requestedPath: "src.ts", workspaceRoot: root, appServer: { readFile } })).resolves.toMatchObject({
      filename: "src.ts",
      text: "export const ready = true;\n",
    });
  });

  it("uses the explicit profile checkout for bot1/acc2", async () => {
    const root = await workspace();
    const slot: CodexAccountSlot = { id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, codexHome: "/Users/bot1/.swarm/codex-profiles/acc2", workspaceRoot: root };
    const readFile = vi.fn(async () => ({ dataBase64: Buffer.from("# acc2\n", "utf8").toString("base64") }));

    await readAccountFile({ account: slot.id, slot, requestedPath: "docs/guide.md", appServer: { readFile } });

    expect(readFile).toHaveBeenCalledWith(resolve(join(root, "docs", "guide.md")));
  });

  it("allows absolute paths, parent-relative paths and symlinks outside the checkout", async () => {
    const root = await workspace();
    const outside = join(directory!, "outside.md");
    await writeFile(outside, "# Outside");
    await symlink(outside, join(root, "docs", "escape.md"));
    const readFile = vi.fn(async (path: string) => ({ dataBase64: (await readNodeFile(path)).toString("base64") }));
    for (const requestedPath of [outside, "../outside.md", "docs/escape.md"]) {
      await expect(readAccountFile({ account: "claudiothe", workspaceRoot: root, requestedPath, appServer: { readFile } })).resolves.toMatchObject({ text: "# Outside" });
    }
  });

  it("delegates private path access to the owning app-server without local realpath checks", async () => {
    const readFile = vi.fn(async () => ({ dataBase64: Buffer.from("private account file").toString("base64") }));
    await expect(readAccountFile({ account: "bot1", workspaceRoot: "/Users/bot1/private-checkout", requestedPath: "/Users/bot1/private-notes.md", appServer: { readFile } })).resolves.toMatchObject({ text: "private account file" });
    expect(readFile).toHaveBeenCalledWith("/Users/bot1/private-notes.md");
  });

  it("preserves operating-system permission errors from the owning account", async () => {
    const readFile = vi.fn(async () => { throw new Error("EACCES: permission denied"); });
    await expect(readAccountFile({ account: "claudiothe", requestedPath: "/private/unreadable", appServer: { readFile } })).rejects.toThrow("EACCES");
  });

  it("expands home-relative links for the selected account", async () => {
    const readFile = vi.fn(async () => ({ dataBase64: Buffer.from("notes").toString("base64") }));
    await readAccountFile({ account: "claudiothe", requestedPath: "~/notes.md", appServer: { readFile } });
    expect(readFile).toHaveBeenCalledWith("/Users/claudiothe/notes.md");
  });

  it("fails closed on malformed base64 or content larger than two MiB", async () => {
    const root = await workspace();
    const malformed = vi.fn(async () => ({ dataBase64: "not base64!" }));
    await expect(readAccountFile({ account: "bot1", requestedPath: "docs/guide.md", workspaceRoot: root, appServer: { readFile: malformed } })).rejects.toThrow(/base64/i);

    const tooLarge = vi.fn(async () => ({ dataBase64: Buffer.alloc((2 * 1024 * 1024) + 1, "a").toString("base64") }));
    await expect(readAccountFile({ account: "bot1", requestedPath: "docs/guide.md", workspaceRoot: root, appServer: { readFile: tooLarge } })).rejects.toThrow(/two MiB/i);
  });

  it("rejects binary content rather than sending it to a text renderer", async () => {
    const root = await workspace();
    const readFile = vi.fn(async () => ({ dataBase64: Buffer.from([0, 255, 0]).toString("base64") }));
    await expect(readAccountFile({ account: "claudiothe", requestedPath: "binary", workspaceRoot: root, appServer: { readFile } })).rejects.toThrow(/text|binary/i);
  });
});
