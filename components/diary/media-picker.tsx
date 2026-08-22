"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Media } from "@/lib/storage/entries";

/**
 * Upload an image and place it in the entry.
 *
 * The spec is explicit that media belongs *between paragraphs*, not in a
 * gallery at the bottom — so the image is inserted as Markdown at the caret,
 * wherever the user last was in the text.
 */
export function MediaPicker({
  onInsert,
  disabled,
}: {
  onInsert: (media: Media) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/media", {
        method: "POST",
        body: form,
      });

      const payload = (await response.json()) as {
        media?: Media;
        error?: string;
      };

      if (!response.ok || !payload.media) {
        setError(payload.error ?? "Couldn't add that image.");
        return;
      }

      onInsert(payload.media);
    } catch {
      setError("Couldn't reach the server. Your entry is unaffected.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      {/*
        `hidden` rather than `sr-only`: the button below is the real control,
        and an sr-only file input leaves a second, unlabelled one sitting in
        the accessibility tree. `display: none` takes it out of the tree while
        still allowing the programmatic `.click()`.
      */}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <Button
        size="sm"
        variant="ghost"
        disabled={disabled || uploading}
        onClick={() => input.current?.click()}
        icon={<ImageIcon />}
      >
        {uploading ? "Adding…" : "Add image"}
      </Button>

      {error ? (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A stored image, with its caption and a way to remove it. */
export function MediaThumb({
  media,
  onRemove,
  className,
}: {
  media: Media;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <figure className={cn("relative", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local upload, sized by the stored record */}
      <img
        src={media.path}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading="lazy"
        className="w-full rounded object-cover"
      />
      {onRemove ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="bg-surface/90 absolute top-1 right-1"
        >
          Remove
        </Button>
      ) : null}
      {media.generated ? (
        <figcaption className="text-meta text-ink-faint mt-1">
          AI-generated
        </figcaption>
      ) : null}
    </figure>
  );
}

function ImageIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 10.5l3-3 2.5 2.5L10.5 7l3.5 3.5" />
      <circle cx="5.75" cy="6" r="0.9" />
    </svg>
  );
}
