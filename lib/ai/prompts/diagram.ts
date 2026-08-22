import type { Message } from "@/lib/ai/gemini";

/**
 * Diagram generation.
 *
 * Phase 6 was specified as image generation. The key has a hard `limit: 0`
 * quota on the Gemini image models — not a rate limit that clears, an
 * entitlement that is not there — so this is the fallback the build plan
 * named: the model writes Mermaid source, the app renders it.
 *
 * That turns out to fit the product better than an image would. A generated
 * picture is opaque and final; Mermaid source is text the author can edit,
 * it lives inside the entry rather than beside it, it costs nothing to store,
 * and it survives the export as readable characters. It is also honest about
 * what it is — the same rule the rest of the AI layer follows.
 *
 * Nothing here imports a server-only module: the sheet needs the kind list
 * and the disclosure, and both have to be available in the browser.
 */

export const DIAGRAM_KINDS = [
  "flow",
  "sequence",
  "tree",
  "architecture",
  "state",
  "entity",
] as const;

export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

interface KindSpec {
  label: string;
  /** What this shape is for, in the picker. */
  hint: string;
  /** Appended to the prompt. Names the Mermaid dialect and its conventions. */
  instruction: string;
}

export const DIAGRAM_SPECS: Record<DiagramKind, KindSpec> = {
  flow: {
    label: "Flow",
    hint: "How something works, step by step",
    instruction: `Use \`flowchart TD\`. One node per step, arrows for what \
follows what. Use \`{...}\` for a decision and label its outgoing arrows \
(\`-->|yes|\`). Keep it to one screen — a flowchart of twenty boxes is a \
wall, not an explanation.`,
  },
  sequence: {
    label: "Sequence",
    hint: "A request flow between parts",
    instruction: `Use \`sequenceDiagram\`. Declare each participant, then the \
messages in order. Show the return arrows (\`-->>\`) where they matter. Use \
\`Note over\` sparingly for the one thing that would otherwise be missed.`,
  },
  tree: {
    label: "Tree",
    hint: "A recursion or call tree",
    instruction: `Use \`flowchart TD\`. Draw the actual call tree for the \
example: the root is the first call with its arguments, each child is a \
recursive call with its own arguments, and leaves are base cases. Label nodes \
with the call, e.g. \`fib(5)\`, not with prose. Two or three levels is enough \
to show the shape; do not expand every branch.`,
  },
  architecture: {
    label: "Architecture",
    hint: "Components of a system and what talks to what",
    instruction: `Use \`flowchart LR\`. Group related components with \
\`subgraph\`. Label the edges with what actually crosses them ("write", \
"cache miss", "async"), because an unlabelled arrow between two boxes says \
almost nothing.`,
  },
  state: {
    label: "State",
    hint: "States and the transitions between them",
    instruction: `Use \`stateDiagram-v2\`. Start from \`[*]\`, name each \
state as a state rather than an action, and label every transition with what \
causes it.`,
  },
  entity: {
    label: "Data model",
    hint: "Entities and their relationships",
    instruction: `Use \`erDiagram\`. Give each entity its key attributes with \
types, and label every relationship with the verb that describes it. Get the \
cardinality right — that is the part a data model is read for.`,
  },
};

/**
 * Strip whatever wrapping the model put around the source.
 *
 * Models return fenced code far more often than they are asked to, and a
 * fence inside a fence renders as a literal ``` in the entry. Cheap to
 * remove here; confusing to discover later in a saved file.
 */
export function sanitiseMermaid(raw: string): string {
  let source = raw.trim();

  // ```mermaid … ``` or plain ``` … ```
  const fenced = /^```[ \t]*[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(
    source,
  );
  if (fenced?.[1] !== undefined) source = fenced[1];

  // A bare "mermaid" line left over from a half-stripped fence.
  source = source.replace(/^mermaid[ \t]*\r?\n/, "");

  return source.trim();
}

/** The permanent marker, kept in the source so its origin survives the file. */
export const AI_DIAGRAM_MARKER = "%% AI-generated diagram";

/**
 * The fence that gets written into the entry.
 *
 * The marker is a Mermaid comment: it renders as nothing, travels with the
 * source wherever it is copied, and is still there in the exported Markdown
 * months later. An "AI-generated" badge that only exists in the UI would not
 * survive the thing this app promises to hand back.
 */
export function toMermaidBlock(source: string): string {
  const clean = sanitiseMermaid(source);
  const marked = clean.startsWith("%%")
    ? clean
    : `${AI_DIAGRAM_MARKER}\n${clean}`;

  return `\`\`\`mermaid\n${marked}\n\`\`\``;
}

const CONTEXT_LIMIT = 4_000;

/** What this action sends, stated before it is sent. */
export function describeDiagramContext(
  description: string,
  selection: string,
): string {
  const sent = (description + selection).length;

  if (!selection.trim()) {
    return `Sends only what you describe below (${description.length.toLocaleString()} characters) to Gemini. The entry itself is not sent.`;
  }

  return `Sends what you describe below plus the ${Math.min(
    selection.length,
    CONTEXT_LIMIT,
  ).toLocaleString()} characters you selected — ${sent.toLocaleString()} in total — to Gemini. The rest of the entry is not sent.`;
}

export function diagramPrompt(input: {
  kind: DiagramKind;
  description: string;
  /** Text the user highlighted, if any. Context, never the whole entry. */
  selection?: string;
}): Message[] {
  const spec = DIAGRAM_SPECS[input.kind];

  const system = `You write Mermaid diagram source, and nothing else.

${spec.instruction}

Hard rules:
- Return raw Mermaid source in the "source" field. No code fences, no \
"mermaid" prefix, no prose around it.
- It must parse. Prefer a simple diagram that renders over a clever one that \
does not.
- Quote any node label containing spaces, punctuation or brackets: \
\`A["fib(n-1)"]\`. An unquoted parenthesis is the most common way Mermaid \
source fails to parse.
- Use only ASCII in node ids. Labels may use normal punctuation.
- Do not invent detail that was not described. If the description is too \
vague to draw, draw the smallest honest version of it and say what is missing \
in "note".
- Do not add styling, colours or \`classDef\`. The app themes the diagram.`;

  const content = input.selection?.trim()
    ? `Diagram to draw:\n${input.description}\n\nContext — text this is about:\n${input.selection.slice(0, CONTEXT_LIMIT)}`
    : `Diagram to draw:\n${input.description}`;

  return [
    { role: "system", content: system },
    { role: "user", content },
  ];
}
