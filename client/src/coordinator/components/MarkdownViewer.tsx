import { CodeViewer } from "./CodeViewer";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { MarkdownDocument } from "../api.js";

export function MarkdownViewer({ document: markdown }: { document: MarkdownDocument }) {
  if (!/\.(?:md|markdown)$/i.test(markdown.filename)) return <CodeViewer filename={markdown.filename} content={markdown.content} />;
  return <article className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{markdown.content}</ReactMarkdown></article>;
}
