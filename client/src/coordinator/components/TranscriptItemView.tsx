import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenCard } from "@/components/primitives/EdenCard";
import { EdenIcon, type IconName } from "@/components/primitives/EdenIcon/EdenIcon";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { TranscriptItem } from "../../shared/contracts.js";
import { filePath } from "../navigation.js";
import { copyMessageSource } from "./TranscriptItemView/copyMessageSource.js";
import { TranscriptViewPreferences } from "./TranscriptTurns/viewPreferences.js";

const filePathPattern = /(?:^|[\s(])((?:\.{1,2}\/|\/)?[A-Za-z0-9_./-]+?\.[A-Za-z0-9]{1,16})(?=$|[\s,)\]])/g;

function stringValues(item: TranscriptItem): string[] {
  const payload = item.payload;
  if (item.type === "userMessage" && Array.isArray(payload.content)) {
    const text = payload.content.flatMap((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? [(part as Record<string, string>).text] : []);
    return text.length ? text : [JSON.stringify(payload)];
  }
  if (item.type === "reasoning") {
    const content = reasoningText(payload.content);
    const summary = reasoningText(payload.summary);
    return content.length ? content : summary.length ? summary : ["Thinking..."];
  }
  const values = [payload.text, payload.command, payload.aggregatedOutput];
  const known = values.filter((value): value is string => typeof value === "string");
  return known.length ? known : [JSON.stringify(payload)];
}

function reasoningText(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : [value];
  return parts.flatMap((part) => typeof part === "string" ? [part] : part && typeof part === "object" && "text" in part && typeof part.text === "string" ? [part.text] : []).filter((part) => part.trim());
}

function filePaths(values: string[]): string[] {
  const paths = new Set<string>();
  for (const value of values) for (const match of value.matchAll(filePathPattern)) paths.add(match[1]);
  return [...paths];
}

function changedFilePaths(item: TranscriptItem): string[] {
  if (item.type !== "fileChange" || !Array.isArray(item.payload.changes)) return [];
  return item.payload.changes.flatMap((change) => change && typeof change === "object" && !Array.isArray(change) && typeof (change as Record<string, unknown>).path === "string" ? [(change as Record<string, string>).path] : []);
}

function workspaceFileHref(href: string | undefined): string | null {
  if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return null;
  const path = href.replace(/^<|>$/g, "").replace(/[?#].*$/, "").replace(/:\d+$/, "");
  return ["/", "/home", "/accounts", "/todos", "/chats"].includes(path) ? null : path;
}

function fileChangeValues(item: TranscriptItem): string[] {
  if (item.type !== "fileChange" || !Array.isArray(item.payload.changes)) return [];
  return item.payload.changes.flatMap((change) => {
    if (!change || typeof change !== "object" || Array.isArray(change)) return [];
    const record = change as Record<string, unknown>;
    const path = typeof record.path === "string" ? record.path : undefined;
    if (!path) return [];
    const kind = typeof record.kind === "string" ? record.kind : "changed";
    return [`${kind} ${path}`];
  });
}

const itemPresentation: Record<string, { label: string; icon: IconName }> = {
  userMessage: { label: "You", icon: "userRound" },
  agentMessage: { label: "Codex", icon: "bot" },
  plan: { label: "Plan", icon: "listChecks" },
  reasoning: { label: "Thinking", icon: "brain" },
  commandExecution: { label: "Command", icon: "squareTerminal" },
  fileChange: { label: "Files changed", icon: "fileDiff" },
  subAgentActivity: { label: "Worker activity", icon: "network" },
  opaque: { label: "Event", icon: "braces" },
};

const messageDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export const TranscriptItemView = memo(function TranscriptItemView({ item, onOpenMarkdown, active = false }: { item: TranscriptItem; onOpenMarkdown: (path: string) => void; active?: boolean }) {
  const preferences = useContext(TranscriptViewPreferences);
  const preferenceKey = `${item.accountId}\u0000${item.threadId}\u0000${item.id}`;
  const [view, setView] = useState(() => preferences?.get(preferenceKey) ?? { expanded: false, renderMarkdown: true });
  const { expanded, renderMarkdown } = view;
  function toggleView(field: "expanded" | "renderMarkdown") {
    const next = { ...view, [field]: !view[field] };
    preferences?.set(preferenceKey, next);
    setView(next);
  }
  const [copied, setCopied] = useState<{ source: string } | null>(null);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2_000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const { values, paths } = useMemo(() => {
    const changes = fileChangeValues(item);
    const values = changes.length ? changes : stringValues(item);
    return { values, paths: changes.length ? changedFilePaths(item) : filePaths(values) };
  }, [item]);
  const presentation = itemPresentation[item.type] ?? { label: "Event", icon: "braces" };
  const icon = presentation.icon;
  const visibleStatus = item.status && item.status !== "completed" ? item.status : null;
  const collapsible = item.type !== "userMessage" && item.type !== "agentMessage";
  const supportsMarkdown = item.type === "userMessage" || item.type === "agentMessage" || item.type === "plan" || item.type === "reasoning";
  const isMessage = item.type === "userMessage" || item.type === "agentMessage";
  const messageSource = values.join("\n\n");
  const sourceCopied = copied?.source === messageSource;
  const createdAtMs = item.createdAt !== null && item.createdAt < 10_000_000_000 ? item.createdAt * 1_000 : item.createdAt;
  const bodyId = `transcript-body-${item.id}`;
  const isExpanded = expanded;
  const previewValues = item.type === "reasoning" ? reasoningText(item.payload.summary) : [];
  const preview = (previewValues.length ? previewValues : values).find((value) => value.trim())?.split(/\r?\n/).find((line) => line.trim()) ?? "";
  async function copySource() {
    setCopyError(false);
    try {
      await copyMessageSource(messageSource);
      setCopied({ source: messageSource });
    } catch {
      setCopied(null);
      setCopyError(true);
    }
  }
  const article = (
    <article className={`transcript-item transcript-item--${item.type}${active ? " transcript-item--active" : ""}`} aria-label={item.type} data-transcript-type={item.type} data-transcript-id={item.id}>
      {collapsible ? <EdenButton density="superCompact" appearance="borderless" isFloating={false} className="transcript-item__disclosure" type="button" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${presentation.label}: ${preview}`} aria-controls={bodyId} aria-expanded={isExpanded} onClick={() => toggleView("expanded")}>
        {active ? <span className="loading-spinner" aria-label="Thinking in progress" /> : <EdenIcon name={icon} aria-hidden="true" size={16} />}
        <span className="transcript-item__preview">{preview}</span>
        {visibleStatus ? <span className="transcript-item__status">{visibleStatus}</span> : null}
        <EdenIcon name={isExpanded ? "chevronUp" : "chevronDown"} aria-hidden="true" size={14} />
      </EdenButton> : <header className="transcript-item__header"><span className="transcript-item__identity"><EdenIcon name={icon} aria-hidden="true" size={16} /><strong>{presentation.label}</strong></span>{visibleStatus ? <span className="transcript-item__status">{visibleStatus}</span> : null}</header>}
      <div id={bodyId} hidden={collapsible && !isExpanded} className={`transcript-item__body${collapsible && !isExpanded ? " transcript-item__body--collapsed" : ""}`}>{collapsible && !isExpanded ? <pre>{preview}</pre> : supportsMarkdown && renderMarkdown ? values.map((value, index) => <div className="transcript-item__markdown markdown-content" key={`${item.id}-${index}`}><ReactMarkdown components={{ a: ({ node: _node, href, ...props }) => { const path = workspaceFileHref(href); return path ? <a {...props} href={filePath(path, item.accountId)} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpenMarkdown(path); }} /> : <a {...props} href={href} target="_blank" rel="noopener noreferrer" />; } }} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{value}</ReactMarkdown></div>) : values.map((value, index) => <pre key={`${item.id}-${index}`}>{value}</pre>)}</div>
      {paths.length && (!collapsible || isExpanded) ? <div className="transcript-item__links">{paths.map((path) => <a href={filePath(path, item.accountId)} key={path} onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpenMarkdown(path);
      }}>{path}</a>)}</div> : null}
      {isMessage || (supportsMarkdown && isExpanded) ? <div className="transcript-item__source-actions">
        {isMessage && createdAtMs !== null ? <time dateTime={new Date(createdAtMs).toISOString()}>{messageDateFormat.format(createdAtMs)}</time> : null}
        {isMessage ? <EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label={sourceCopied ? "Message source copied" : "Copy message source"} title={sourceCopied ? "Copied" : "Copy message source"} onClick={() => void copySource()}>{sourceCopied ? <EdenIcon name="check" aria-hidden="true" size={14} /> : <EdenIcon name="copy" aria-hidden="true" size={14} />}</EdenButton> : null}
        {supportsMarkdown ? <EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label={renderMarkdown ? "Show plain text" : "Render Markdown"} title={renderMarkdown ? "Show plain text" : "Render Markdown"} aria-pressed={renderMarkdown} onClick={() => toggleView("renderMarkdown")}><EdenIcon name="code2" aria-hidden="true" size={14} strokeWidth={1.75} /></EdenButton> : null}
      </div> : null}
      {copyError ? <p role="alert">Unable to copy. Select the message text and copy it manually.</p> : null}
    </article>
  );
  return item.type === "userMessage" ? <EdenCard asChild>{article}</EdenCard> : article;
});
