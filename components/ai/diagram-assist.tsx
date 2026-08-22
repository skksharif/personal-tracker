"use client";

import { useState } from "react";

import { generateDiagramAction } from "@/app/actions/ai";
import { AiPanel } from "@/components/ai/ai-panel";
import { MermaidDiagram } from "@/components/markdown/mermaid";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import {
  DIAGRAM_KINDS,
  DIAGRAM_SPECS,
  describeDiagramContext,
  toMermaidBlock,
  type DiagramKind,
} from "@/lib/ai/prompts/diagram";
import type { Diagram } from "@/lib/ai/schema";
import { cn } from "@/lib/cn";

/**
 * Draw a diagram, and put it in the entry.
 *
 * Phase 6 as built. The model returns Mermaid source, the panel renders it
 * with the same component that renders it in the finished entry — so the
 * preview is the artefact, not an approximation of it — and accepting writes
 * a fenced block at the caret.
 *
 * The failure mode is visible rather than hidden: invalid source shows as
 * source with the parser's complaint underneath, and Regenerate is one click
 * away. Nothing is written until Insert, so a diagram that will not draw
 * costs the entry nothing.
 */

function DiagramIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5.5" y="1.5" width="5" height="3.5" rx="0.6" />
      <rect x="1.5" y="11" width="5" height="3.5" rx="0.6" />
      <rect x="9.5" y="11" width="5" height="3.5" rx="0.6" />
      <path d="M8 5v3M8 8H4v3M8 8h4v3" />
    </svg>
  );
}

export function DiagramAssist({
  onInsert,
  configured,
  /** Text the user highlighted in the editor, if any. */
  selection = "",
  disabled = false,
  label = "Diagram",
}: {
  onInsert: (block: string) => void;
  configured: boolean;
  selection?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DiagramKind>("flow");
  const [description, setDescription] = useState("");

  if (!configured) return null;

  const ready = description.trim().length >= 3;

  return (
    <>
      <Button
        size="sm"
        variant="ai"
        icon={<DiagramIcon />}
        onClick={() => {
          // A selection is a strong hint about what to draw, but it is only a
          // starting point — the field stays editable and is what gets sent.
          setDescription(
            (current) =>
              current || (selection.trim() ? summarise(selection) : ""),
          );
          setOpen(true);
        }}
        disabled={disabled}
      >
        {label}
      </Button>

      <AiPanel<Diagram>
        open={open}
        onClose={() => setOpen(false)}
        title="Draw a diagram"
        disclosure={describeDiagramContext(description, selection)}
        runLabel="Draw it"
        pendingLabel="Working out the shape…"
        acceptLabel="Insert here"
        runDisabled={!ready}
        run={() =>
          generateDiagramAction({
            kind,
            description,
            ...(selection.trim() ? { selection } : {}),
          })
        }
        onAccept={(data) => onInsert(toMermaidBlock(data.source))}
        inputs={
          <div className="space-y-4">
            <fieldset>
              <legend className="text-meta text-ink-muted mb-2">Shape</legend>
              <div className="flex flex-wrap gap-1.5">
                {DIAGRAM_KINDS.map((option) => {
                  const spec = DIAGRAM_SPECS[option];
                  const active = kind === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setKind(option)}
                      aria-pressed={active}
                      title={spec.hint}
                      className={cn(
                        "text-meta rounded-full px-3 py-1.5 transition-colors",
                        active
                          ? "bg-ai-soft text-ai"
                          : "bg-surface-sunken text-ink-secondary hover:text-ink",
                      )}
                    >
                      {spec.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-meta text-ink-faint mt-2">
                {DIAGRAM_SPECS[kind].hint}
              </p>
            </fieldset>

            <Field
              label="What should it show?"
              hint={
                selection.trim()
                  ? "The text you selected is sent as context."
                  : "Be specific — the diagram can only show what you describe."
              }
            >
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  minRows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="The call tree for fib(5), down to the base cases"
                />
              )}
            </Field>
          </div>
        }
      >
        {(data) => (
          <div className="space-y-3">
            {data.note ? (
              <p className="text-meta text-ink-muted">{data.note}</p>
            ) : null}

            {/*
              Rendered by the same component the entry uses, so what is
              previewed is exactly what lands in the file — including the
              failure case, which shows the source and says why.
            */}
            <div className="border-line bg-surface-sunken rounded-md border px-3">
              <MermaidDiagram source={data.source} />
            </div>

            <details>
              <summary className="text-meta text-ink-muted hover:text-ink cursor-pointer">
                Show the source
              </summary>
              <pre className="bg-surface-sunken text-meta mt-2 overflow-x-auto rounded-md p-3 font-mono">
                {data.source}
              </pre>
            </details>

            <p className="text-meta text-ink-faint">
              Inserting puts this where your cursor is, as Mermaid source you
              can edit. It is marked as AI-generated in the source itself.
            </p>
          </div>
        )}
      </AiPanel>
    </>
  );
}

/**
 * Turn a selection into a starting description.
 *
 * Just the first sentence or so — enough that the field is not empty, short
 * enough that the user rewrites it rather than sending back their own
 * paragraph as an instruction.
 */
function summarise(selection: string): string {
  const trimmed = selection.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 120) return trimmed;

  const cut = trimmed.slice(0, 120);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 60 ? cut.slice(0, lastSpace) : cut}…`;
}
