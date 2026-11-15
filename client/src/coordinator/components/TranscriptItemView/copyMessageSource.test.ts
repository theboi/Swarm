import { afterEach, describe, expect, it, vi } from "vitest";
import { copyMessageSource } from "./copyMessageSource";

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe("copyMessageSource", () => {
  it("uses the clipboard API without altering selection when available", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyMessageSource("**Exact**\n source ");
    expect(writeText).toHaveBeenCalledWith("**Exact**\n source ");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it.each(["missing", "rejected"])("copies through native selection when the clipboard API is %s", async (mode) => {
    vi.stubGlobal("navigator", mode === "missing" ? {} : { clipboard: { writeText: async () => { throw new Error("denied"); } } });
    const editor = document.createElement("textarea");
    editor.value = "Keep this draft";
    document.body.append(editor);
    editor.focus();
    editor.setSelectionRange(2, 6);
    let copied = "";
    Object.defineProperty(document, "execCommand", { configurable: true, value: (command: string) => {
      expect(command).toBe("copy");
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    } });
    await copyMessageSource("**Exact**\n source ");
    expect(copied).toBe("**Exact**\n source ");
    expect(document.activeElement).toBe(editor);
    expect(editor.selectionStart).toBe(2);
    expect(editor.selectionEnd).toBe(6);
    expect(document.querySelectorAll("textarea")).toHaveLength(1);
  });

  it("rejects a failed fallback and removes the temporary selection field", async () => {
    vi.stubGlobal("navigator", {});
    Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
    await expect(copyMessageSource("Not copied")).rejects.toThrow("Unable to copy");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
