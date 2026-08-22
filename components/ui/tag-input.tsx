"use client";

import { useState, type KeyboardEvent } from "react";

import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
  "aria-describedby"?: string;
}

/**
 * Tag entry. Enter or comma commits; Backspace on an empty field removes the
 * last tag. Duplicates and blanks are dropped silently rather than scolding
 * the user mid-thought.
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Add a tag",
  id,
  "aria-describedby": describedBy,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "border-control-border flex flex-wrap items-center gap-1.5 rounded-md border",
        "bg-surface focus-within:border-accent px-2 py-2 transition-colors",
      )}
    >
      {value.map((tag) => (
        <Tag
          key={tag}
          onRemove={() => onChange(value.filter((t) => t !== tag))}
          removeLabel={`Remove tag ${tag}`}
        >
          {tag}
        </Tag>
      ))}

      <input
        id={id}
        aria-describedby={describedBy}
        aria-label={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        className={cn(
          "text-small min-w-24 flex-1 border-0 bg-transparent px-1 py-0.5",
          "text-ink placeholder:text-ink-faint focus:outline-none",
        )}
      />
    </div>
  );
}
