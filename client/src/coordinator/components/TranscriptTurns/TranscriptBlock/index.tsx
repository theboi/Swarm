import { memo, useEffect, useRef, useState } from "react";
import type { TranscriptItem } from "../../../../shared/contracts.js";
import { TranscriptItemView } from "../../TranscriptItemView.js";

type TranscriptBlockProps = {
  items: TranscriptItem[];
  initiallyVisible: boolean;
  activeReasoningId?: string;
  onOpenMarkdown: (path: string) => void;
};

/** Offload expensive Markdown trees, retaining their measured space in normal flow. */
export const TranscriptBlock = memo(function TranscriptBlock({
  items,
  initiallyVisible,
  activeReasoningId,
  onOpenMarkdown,
}: TranscriptBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [window, setWindow] = useState(() => ({
    visible: initiallyVisible || typeof IntersectionObserver === "undefined",
    height: items.reduce(
      (height, item) =>
        height +
        (item.type === "userMessage" || item.type === "agentMessage"
          ? 160
          : 48),
      0,
    ),
  }));
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    let root = element.parentElement;
    while (
      root &&
      !/(auto|scroll)/.test(
        getComputedStyle(root).overflowY || getComputedStyle(root).overflow,
      )
    )
      root = root.parentElement;
    let intersecting = true;
    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      const selection = element.ownerDocument.getSelection();
      // Keep native selection, clipboard operations and keyboard focus intact.
      const interacting =
        element.contains(element.ownerDocument.activeElement) ||
        Boolean(
          selection &&
          !selection.isCollapsed &&
          Array.from({ length: selection.rangeCount }, (_, index) =>
            selection.getRangeAt(index),
          ).some((range) => range.intersectsNode(element)),
        );
      const visible = intersecting || interacting;
      const height = element.getBoundingClientRect().height;
      setWindow((previous) =>
        previous.visible === visible
          ? previous
          : { visible, height: height || previous.height },
      );
      // Listen only while pinned, rather than retaining document listeners for every block.
      if (!intersecting && interacting) {
        element.addEventListener("focusout", afterFocus);
        element.ownerDocument.addEventListener("selectionchange", refresh);
      } else {
        element.removeEventListener("focusout", afterFocus);
        element.ownerDocument.removeEventListener("selectionchange", refresh);
      }
    };
    function afterFocus() {
      queueMicrotask(refresh);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        refresh();
      },
      { root, rootMargin: "1000px 0px" },
    );
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      element.removeEventListener("focusout", afterFocus);
      element.ownerDocument.removeEventListener("selectionchange", refresh);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="transcript-block"
      data-transcript-block=""
      style={window.visible ? undefined : { blockSize: window.height }}
    >
      {window.visible
        ? items.map((item) => (
            <TranscriptItemView
              key={item.id}
              item={item}
              active={item.id === activeReasoningId}
              onOpenMarkdown={onOpenMarkdown}
            />
          ))
        : null}
    </div>
  );
});
