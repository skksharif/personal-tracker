import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "@/components/markdown/mermaid";
import { cn } from "@/lib/cn";

/**
 * The document renderer, shared by the diary and every technical note.
 *
 * Three things it has to get right:
 *
 *   - Images sit where they were written, between paragraphs.
 *   - Code is highlighted server-side, so a note full of snippets costs the
 *     browser no JavaScript.
 *   - ```mermaid blocks become diagrams, and stay readable as text if they
 *     cannot be drawn.
 */

interface HastNode {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

/**
 * True when a paragraph holds nothing but an image.
 *
 * Markdown wraps a standalone image in a paragraph, but images render as a
 * `<figure>` — and a figure inside a `<p>` is invalid HTML the browser
 * silently reparents, which shows up as a hydration mismatch.
 */
function isImageOnly(node: HastNode | undefined): boolean {
  const meaningful = (node?.children ?? []).filter((child) =>
    child.type === "text" ? (child.value ?? "").trim() !== "" : true,
  );

  return (
    meaningful.length === 1 &&
    meaningful[0]?.type === "element" &&
    meaningful[0]?.tagName === "img"
  );
}

/** Pull the language and raw text out of a `<pre><code>` node. */
function readCodeBlock(
  node: HastNode | undefined,
): { language: string; text: string } | null {
  const code = node?.children?.find(
    (child) => child.type === "element" && child.tagName === "code",
  );
  if (!code) return null;

  const classes = Array.isArray(code.properties?.className)
    ? (code.properties.className as string[])
    : [];

  const language =
    classes
      .find((name) => name.startsWith("language-"))
      ?.replace("language-", "") ?? "";

  // Collect text through however many spans the highlighter produced.
  const collect = (n: HastNode): string =>
    n.type === "text"
      ? (n.value ?? "")
      : (n.children ?? []).map(collect).join("");

  return { language, text: collect(code) };
}

export function RenderedMarkdown({
  body,
  className,
  emptyMessage = "Nothing written yet.",
}: {
  body: string;
  className?: string;
  emptyMessage?: string;
}) {
  if (!body.trim()) {
    return (
      <p className={cn("text-small text-ink-faint italic", className)}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("prose-journal", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        // `ignoreMissing` so an unknown language in a fence is rendered plain
        // rather than throwing and losing the note.
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        components={{
          p: ({ node, children }) =>
            isImageOnly(node as HastNode | undefined) ? (
              <>{children}</>
            ) : (
              <p>{children}</p>
            ),

          img: ({ src, alt }) =>
            typeof src === "string" ? (
              <figure className="my-6">
                {/* eslint-disable-next-line @next/next/no-img-element -- local upload; intrinsic size unknown here */}
                <img
                  src={src}
                  alt={alt ?? ""}
                  loading="lazy"
                  className="w-full rounded"
                />
                {alt ? (
                  <figcaption className="text-meta text-ink-muted mt-2 text-center">
                    {alt}
                  </figcaption>
                ) : null}
              </figure>
            ) : null,

          pre: ({ node, children }) => {
            const block = readCodeBlock(node as HastNode | undefined);

            if (block?.language === "mermaid") {
              return <MermaidDiagram source={block.text.trimEnd()} />;
            }

            return (
              <pre className="bg-surface-sunken text-meta border-line my-5 overflow-x-auto rounded-md border p-4 font-mono">
                {children}
              </pre>
            );
          },

          table: ({ children }) => (
            <div className="my-5 overflow-x-auto">
              <table className="text-small w-full border-collapse">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-line text-ink border-b px-3 py-2 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-line border-b px-3 py-2 align-top">
              {children}
            </td>
          ),
        }}
      >
        {body}
      </Markdown>
    </div>
  );
}
