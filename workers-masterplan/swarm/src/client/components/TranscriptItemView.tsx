import { Bot, Braces, Brain, Check, ChevronDown, ChevronUp, Code2, Copy, FileDiff, ListChecks, Network, SquareTerminal, UserRound, type LucideIcon } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { TranscriptItem } from "../../shared/contracts.js";
import { filePath } from "../navigation.js";

const filePathPattern = /(?:^|[\s(])((?:\.{1,2}\/|\/)?[A-Za-z0-9_./-]+?\.[A-Za-z0-9]{1,16})(?=$|[\s,)\]])/g;

function stringValues(item: TranscriptItem): string[] {
  const payload = item.payload;
  if (item.type === "userMessage" && Array.isArray(payload.content)) {
    const text = payload.content.flatMap((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? [(part as Record<string, string>).text] : []);
    return text.length ? text : [JSON.stringify(payload)];
  }
  if (item.type === "reasoning" && Array.isArray(payload.summary)) {
    const summary = payload.summary.filter((value): value is string => typeof value === "string");
    return summary.length ? summary : [JSON.stringify(payload)];
  }
  const values = [payload.text, payload.command, payload.aggregatedOutput];
  const known = values.filter((value): value is string => typeof value === "string");
  return known.length ? known : [JSON.stringify(payload)];
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
  return ["/", "/home", "/accounts", "/flowchart", "/chats"].includes(path) ? null : path;
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

const itemPresentation: Record<string, { label: string; icon: LucideIcon }> = {
  userMessage: { label: "You", icon: UserRound },
  agentMessage: { label: "Codex", icon: Bot },
  plan: { label: "Plan", icon: ListChecks },
  reasoning: { label: "Thinking", icon: Brain },
  commandExecution: { label: "Command", icon: SquareTerminal },
  fileChange: { label: "Files changed", icon: FileDiff },
  subAgentActivity: { label: "Worker activity", icon: Network },
  opaque: { label: "Event", icon: Braces },
};

export function TranscriptItemView({ item, onOpenMarkdown, active = false }: { item: TranscriptItem; onOpenMarkdown: (path: string) => void; active?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [renderMarkdown, setRenderMarkdown] = useState(true);
  const [sourceCopied, setSourceCopied] = useState(false);
  const changes = fileChangeValues(item);
  const values = changes.length ? changes : stringValues(item);
  const paths = changes.length ? changedFilePaths(item) : filePaths(values);
  const presentation = itemPresentation[item.type] ?? { label: "Event", icon: Braces };
  const Icon = presentation.icon;
  const visibleStatus = item.status && item.status !== "completed" ? item.status : null;
  const collapsible = item.type !== "userMessage" && item.type !== "agentMessage";
  const supportsMarkdown = item.type === "userMessage" || item.type === "agentMessage" || item.type === "plan" || item.type === "reasoning";
  const isMessage = item.type === "userMessage" || item.type === "agentMessage";
  const messageSource = values.join("\n\n");
  const createdAtMs = item.createdAt !== null && item.createdAt < 10_000_000_000 ? item.createdAt * 1_000 : item.createdAt;
  const bodyId = `transcript-body-${item.id}`;
  const isExpanded = active || expanded;
  return (
    <article className={`transcript-item transcript-item--${item.type}${active ? " transcript-item--active" : ""}`} aria-label={item.type} data-transcript-type={item.type}>
      <header className="transcript-item__header"><span className="transcript-item__identity">{active ? <span className="loading-spinner" aria-label="Thinking in progress" /> : <Icon aria-hidden="true" size={16} strokeWidth={1.75} />}<strong>{presentation.label}</strong></span><span className="transcript-item__header-actions">{visibleStatus ? <span className="transcript-item__status">{visibleStatus}</span> : null}{collapsible ? <button className="transcript-item__expand" type="button" aria-label={isExpanded ? `Collapse ${presentation.label}` : `Expand ${presentation.label}`} title={isExpanded ? "Collapse" : "Expand"} aria-controls={bodyId} aria-expanded={isExpanded} onClick={() => setExpanded((value) => !value)}>{isExpanded ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}</button> : null}</span></header>
      <div id={bodyId} className={`transcript-item__body${collapsible && !isExpanded ? " transcript-item__body--collapsed" : ""}`}>{supportsMarkdown && renderMarkdown ? values.map((value, index) => <div className="transcript-item__markdown markdown-content" key={`${item.id}-${index}`}><ReactMarkdown components={{ a: ({ node: _node, href, ...props }) => { const path = workspaceFileHref(href); return path ? <a {...props} href={filePath(path, item.accountId)} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpenMarkdown(path); }} /> : <a {...props} href={href} target="_blank" rel="noopener noreferrer" />; } }} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{value}</ReactMarkdown></div>) : values.map((value, index) => <pre key={`${item.id}-${index}`}>{value}</pre>)}</div>
      {paths.length ? <div className="transcript-item__links">{paths.map((path) => <a href={filePath(path, item.accountId)} key={path} onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpenMarkdown(path);
      }}>{path}</a>)}</div> : null}
      {isMessage || supportsMarkdown ? <div className="transcript-item__source-actions">
        {isMessage && createdAtMs !== null ? <time dateTime={new Date(createdAtMs).toISOString()}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(createdAtMs)}</time> : null}
        {isMessage ? <button type="button" aria-label={sourceCopied ? "Message source copied" : "Copy message source"} title={sourceCopied ? "Copied" : "Copy message source"} onClick={() => { void navigator.clipboard.writeText(messageSource).then(() => setSourceCopied(true)); }}>{sourceCopied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}</button> : null}
        {supportsMarkdown ? <button type="button" aria-label={renderMarkdown ? "Show plain text" : "Render Markdown"} title={renderMarkdown ? "Show plain text" : "Render Markdown"} aria-pressed={renderMarkdown} onClick={() => setRenderMarkdown((enabled) => !enabled)}><Code2 aria-hidden="true" size={14} strokeWidth={1.75} /></button> : null}
      </div> : null}
    </article>
  );
}
