import type { TranscriptItem } from "../../shared/contracts.js";

const markdownPathPattern = /(?:^|[\s(])((?:\.{1,2}\/|\/)?[A-Za-z0-9_./-]+?\.(?:md|markdown))(?=$|[\s,)\]])/gi;

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

function markdownPaths(values: string[]): string[] {
  const paths = new Set<string>();
  for (const value of values) for (const match of value.matchAll(markdownPathPattern)) paths.add(match[1]);
  return [...paths];
}

export function TranscriptItemView({ item, onOpenMarkdown }: { item: TranscriptItem; onOpenMarkdown: (path: string) => void }) {
  const values = stringValues(item);
  const paths = markdownPaths(values);
  return (
    <article className={`transcript-item transcript-item--${item.type}`} aria-label={item.type}>
      <header><strong>{item.type}</strong>{item.status ? <span>{item.status}</span> : null}</header>
      {values.map((value, index) => <pre key={`${item.id}-${index}`}>{value}</pre>)}
      {paths.map((path) => <a href={`#markdown-${encodeURIComponent(path)}`} key={path} onClick={(event) => { event.preventDefault(); onOpenMarkdown(path); }}>{path}</a>)}
    </article>
  );
}
