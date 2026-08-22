import { describe, expect, it } from "vitest";

import {
  AI_DIAGRAM_MARKER,
  DIAGRAM_KINDS,
  DIAGRAM_SPECS,
  describeDiagramContext,
  diagramPrompt,
  sanitiseMermaid,
  toMermaidBlock,
} from "@/lib/ai/prompts/diagram";
import { diagramSchema } from "@/lib/ai/schema";

/**
 * Diagram generation.
 *
 * Phase 6 as built: the model returns Mermaid source and the app renders it.
 * The risk is not a bad drawing — the user sees that before accepting — it is
 * malformed source landing inside a saved entry, and a disclosure that
 * understates what gets sent.
 */

describe("sanitiseMermaid", () => {
  it("leaves clean source alone", () => {
    const source = "flowchart TD\n  A --> B";
    expect(sanitiseMermaid(source)).toBe(source);
  });

  it("unwraps a mermaid code fence", () => {
    expect(sanitiseMermaid("```mermaid\nflowchart TD\n  A --> B\n```")).toBe(
      "flowchart TD\n  A --> B",
    );
  });

  it("unwraps a bare code fence", () => {
    expect(sanitiseMermaid("```\nsequenceDiagram\n  A->>B: hi\n```")).toBe(
      "sequenceDiagram\n  A->>B: hi",
    );
  });

  it("drops a stray language line", () => {
    expect(sanitiseMermaid("mermaid\nflowchart TD\n  A --> B")).toBe(
      "flowchart TD\n  A --> B",
    );
  });

  it("keeps a fence that is part of the diagram's own text", () => {
    // Not wrapped: the fence does not open the string, so nothing is stripped.
    const source = 'flowchart TD\n  A["```"] --> B';
    expect(sanitiseMermaid(source)).toBe(source);
  });
});

describe("toMermaidBlock", () => {
  it("wraps the source in a mermaid fence", () => {
    const block = toMermaidBlock("flowchart TD\n  A --> B");

    expect(block.startsWith("```mermaid\n")).toBe(true);
    expect(block.endsWith("\n```")).toBe(true);
  });

  it("marks the source as AI-generated, permanently", () => {
    // Inside the fence, so the marker survives into the saved file and the
    // export — not just the moment it was accepted.
    expect(toMermaidBlock("flowchart TD\n  A --> B")).toContain(
      AI_DIAGRAM_MARKER,
    );
  });

  it("does not double-mark source that already carries a comment", () => {
    const already = `${AI_DIAGRAM_MARKER}\nflowchart TD\n  A --> B`;
    const block = toMermaidBlock(already);

    expect(block.split(AI_DIAGRAM_MARKER)).toHaveLength(2);
  });

  it("never nests a fence inside a fence", () => {
    const block = toMermaidBlock("```mermaid\nflowchart TD\n  A --> B\n```");
    expect(block.match(/```/g)).toHaveLength(2);
  });
});

describe("the prompt", () => {
  it("covers every kind the picker offers", () => {
    for (const kind of DIAGRAM_KINDS) {
      expect(DIAGRAM_SPECS[kind].label).toBeTruthy();
      expect(DIAGRAM_SPECS[kind].instruction.length).toBeGreaterThan(40);
    }
  });

  it("names the Mermaid dialect for the chosen kind", () => {
    const [system] = diagramPrompt({
      kind: "sequence",
      description: "a login request",
    });

    expect(system?.content).toContain("sequenceDiagram");
    expect(system?.content).not.toContain("erDiagram");
  });

  it("sends only the description when nothing is selected", () => {
    const [, user] = diagramPrompt({
      kind: "flow",
      description: "how a retry works",
    });

    expect(user?.content).toContain("how a retry works");
    expect(user?.content).not.toContain("Context");
  });

  it("caps the selection it carries as context", () => {
    const [, user] = diagramPrompt({
      kind: "flow",
      description: "draw this",
      selection: "x".repeat(10_000),
    });

    expect(user?.content.length).toBeLessThan(4_200);
  });
});

describe("the disclosure", () => {
  it("says the entry is not sent when nothing is selected", () => {
    const notice = describeDiagramContext("a call tree for fib(5)", "");

    expect(notice).toContain("The entry itself is not sent");
    expect(notice).toContain("22");
  });

  it("accounts for the selection when there is one", () => {
    const notice = describeDiagramContext("draw this", "y".repeat(100));

    expect(notice).toContain("100");
    expect(notice).toContain("The rest of the entry is not sent");
  });

  it("states the truncated length, not the full one", () => {
    const notice = describeDiagramContext("draw this", "y".repeat(9_000));

    expect(notice).toContain("4,000");
    expect(notice).not.toContain("9,000");
  });
});

describe("the response schema", () => {
  it("requires source but nothing else", () => {
    expect(
      diagramSchema.safeParse({ source: "flowchart TD\n A-->B" }).success,
    ).toBe(true);
    expect(diagramSchema.safeParse({ title: "A diagram" }).success).toBe(false);
  });

  it("rejects empty source rather than accepting a blank diagram", () => {
    expect(diagramSchema.safeParse({ source: "" }).success).toBe(false);
  });
});
