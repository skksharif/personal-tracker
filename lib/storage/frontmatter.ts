import { DUMP_SCHEMA, JSON_SCHEMA, dump, load } from "js-yaml";

/**
 * Markdown front matter, serialized explicitly.
 *
 * This is deliberately hand-rolled rather than delegated to `gray-matter`.
 * That library re-parses the *body* you hand it, so a diary entry whose first
 * line is `---` (an ordinary horizontal rule) gets absorbed into the YAML and
 * destroyed on write. The user's original text is the source of truth, so the
 * round-trip has to be exact.
 *
 * Two rules make it exact:
 *
 *   Write — the body is never inspected. YAML is generated from the front
 *           matter object alone and the body is appended verbatim.
 *   Read  — exactly one leading delimited block is stripped, matched
 *           non-greedily, so the first `---` after the opening block closes it
 *           and everything after belongs to the body.
 */

/** Opening `---`, the YAML block, then the first `---` on its own line. */
const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

/**
 * Split a Markdown document into front matter and body.
 * A document without front matter is all body.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  // Strip a UTF-8 BOM so a file touched by a Windows editor still parses.
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  const match = FRONT_MATTER.exec(text);
  if (!match) return { data: {}, body: text.trim() };

  const block = match[1] ?? "";
  const body = text.slice(match[0].length).trim();

  // An empty block is a valid document with no metadata; js-yaml throws on it.
  if (block.trim() === "") return { data: {}, body };

  // JSON_SCHEMA on load, so `date: 2026-08-16` stays a string instead of
  // becoming a Date and failing every `z.string()` in the app.
  const loaded = load(block, { schema: JSON_SCHEMA });

  const data =
    loaded !== null && typeof loaded === "object" && !Array.isArray(loaded)
      ? (loaded as Record<string, unknown>)
      : {};

  return { data, body };
}

/**
 * Serialize front matter and body into a Markdown document.
 * The body is written through untouched.
 */
export function stringifyFrontmatter(
  data: Record<string, unknown>,
  body: string,
): string {
  // DUMP_SCHEMA quotes ambiguous scalars — `date: '2026-08-16'` rather than a
  // bare value another YAML reader would resolve to a date.
  const frontmatter = dump(data, {
    schema: DUMP_SCHEMA,
    lineWidth: 100,
    noRefs: true,
  });

  const trimmedBody = body.trim();
  return `---\n${frontmatter}---\n\n${trimmedBody}${trimmedBody ? "\n" : ""}`;
}
