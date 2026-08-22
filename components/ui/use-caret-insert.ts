"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Put something where the caret is, and know what is selected.
 *
 * Shared by the diary and the note editor so an image and a diagram land the
 * same way in both: the block goes between paragraphs at the caret, blank
 * lines are normalised around it, and the caret ends up after it so writing
 * continues below rather than inside.
 *
 * `selection` is what the AI features use as context — the text the author
 * pointed at, never the whole entry.
 */
export function useCaretInsert(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState("");

  /** Wire to `onSelect`, which fires for mouse and keyboard alike. */
  const trackSelection = useCallback(() => {
    const textarea = ref.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    setSelection(start === end ? "" : value.slice(start, end));
  }, [value]);

  const insert = useCallback(
    (block: string, apply: (nextBody: string) => void) => {
      const textarea = ref.current;

      if (!textarea) {
        apply(value.trim() ? `${value}\n\n${block}\n` : `${block}\n`);
        return;
      }

      const at = textarea.selectionStart ?? value.length;
      const before = value.slice(0, at).replace(/\s+$/, "");
      const after = value.slice(at).replace(/^\s+/, "");

      apply([before, block, after].filter(Boolean).join("\n\n"));

      // Exactly after the inserted block — accounting for the separator only
      // when there is something before it to separate from.
      const position = (before ? before.length + 2 : 0) + block.length;

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(position, position);
      });
    },
    [value],
  );

  return { ref, selection, trackSelection, insert };
}
