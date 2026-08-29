import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useEffect, useRef } from "react";

import type { MarkdownDocument } from "../api.js";
import { OverlayCloseButton } from "./OverlayCloseButton.js";

export function MarkdownViewer({ document: markdown, onClose }: { document: MarkdownDocument; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => previousFocus.current?.focus();
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="markdown-viewer" role="dialog" aria-modal="true" aria-labelledby="markdown-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]; const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}>
        <OverlayCloseButton ref={closeButton} onClick={onClose} />
        <header><h2 id="markdown-title">{markdown.filename}</h2></header>
        <article className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{markdown.content}</ReactMarkdown></article>
      </section>
    </div>
  );
}
