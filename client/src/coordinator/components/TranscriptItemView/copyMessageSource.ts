/** Copy exact source, including on HTTP origins without the asynchronous API. */
export async function copyMessageSource(source: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(source);
      return;
    }
  } catch {
    // A browser may expose the API but deny access for this origin/session.
  }

  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = Array.from({ length: selection?.rangeCount ?? 0 }, (_, index) => selection!.getRangeAt(index).cloneRange());
  const inputSelection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection }
    : null;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const field = document.createElement("textarea");
  field.value = source;
  field.readOnly = true;
  field.tabIndex = -1;
  field.setAttribute("aria-label", "Copy message source");
  // This temporary native selection target is removed synchronously before paint.
  // No visually-hidden styling or persistent extra keyboard target is needed.
  document.body.append(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    if (!document.execCommand?.("copy")) throw new Error("Unable to copy message source");
  } finally {
    field.remove();
    if (active instanceof HTMLElement && active.isConnected) active.focus({ preventScroll: true });
    if (inputSelection && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && inputSelection.start !== null && inputSelection.end !== null) {
      active.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction ?? undefined);
    }
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) window.scrollTo(scrollX, scrollY);
  }
}
