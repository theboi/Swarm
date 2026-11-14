import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { MarkdownDocument } from "../api.js";

export function MarkdownViewer({ document: markdown }: { document: MarkdownDocument }) {
  return (
        <article className="markdown-content">{/\.(?:md|markdown)$/i.test(markdown.filename) ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{markdown.content}</ReactMarkdown> : <pre className="file-viewer__plain">{markdown.content}</pre>}</article>
  );
}
