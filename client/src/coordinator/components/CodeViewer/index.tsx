import { common, createLowlight } from "lowlight";
import type { RootContent } from "hast";
import { useMemo, type ReactNode } from "react";
import styles from "./styles.module.scss";

const highlighter = createLowlight(common);
const LANGUAGES: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", rb: "ruby", rs: "rust",
  sh: "bash", zsh: "bash", bash: "bash", yml: "yaml", h: "c", hpp: "cpp",
  cs: "csharp", html: "xml", htm: "xml", svg: "xml", vue: "xml", svelte: "xml",
};

function renderToken(node: RootContent, key: number): ReactNode {
  if (node.type === "text") return node.value;
  if (node.type !== "element") return null;
  const classes = Array.isArray(node.properties.className) ? node.properties.className.filter((value): value is string => typeof value === "string") : [];
  return <span key={key} className={classes.map((name) => `${name} ${styles[name] ?? ""}`).join(" ")}>{node.children.map(renderToken)}</span>;
}

export function CodeViewer({ filename, content }: { filename: string; content: string }) {
  const extension = filename.split(".").at(-1)?.toLowerCase() ?? "";
  const candidate = filename === "Dockerfile" ? "dockerfile" : filename === "Makefile" ? "makefile" : LANGUAGES[extension] ?? extension;
  const language = highlighter.registered(candidate) ? candidate : undefined;
  const tokens = useMemo(() => {
    if (!language || content.length > 256 * 1024) return null;
    try { return highlighter.highlight(language, content).children.map(renderToken); }
    catch { return null; }
  }, [content, language]);
  return <section className={styles.viewer} aria-label="File source">
    <p className={styles.language}>{tokens ? language : "Plain text"}</p>
    <pre className={styles.source} tabIndex={0} aria-label="Source code"><code data-language={tokens ? language : "text"}>{tokens ?? content}</code></pre>
  </section>;
}
