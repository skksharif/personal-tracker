"use client";

import { useState, type ReactNode } from "react";

import {
  BareInput,
  BareTextarea,
  Button,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Separator,
  Sheet,
  Skeleton,
  SkeletonText,
  Surface,
  Tag,
  TagInput,
  Textarea,
  useToast,
} from "@/components/ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-section">
      <h2 className="text-meta text-ink-muted mb-4 font-medium tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

const SWATCHES = [
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["surface-sunken", "bg-surface-sunken"],
  ["accent", "bg-accent"],
  ["ai", "bg-ai"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
] as const;

export function DesignSystemDemo() {
  const [tags, setTags] = useState(["recursion", "dp"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { show } = useToast();

  return (
    <div>
      <Section title="Colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(([name, className]) => (
            <div key={name}>
              <div
                className={`${className} border-line h-14 rounded-md border`}
              />
              <p className="text-meta text-ink-muted mt-1.5 font-mono">
                {name}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-4">
          <p className="text-meta text-ink-muted">
            Meta · 13px · dates, counts, labels
          </p>
          <p className="text-small text-ink-secondary">
            Small · 15px · secondary interface text
          </p>
          <p className="text-body text-ink">Body · 17px · reading</p>
          <p className="text-title text-ink">Title · 22px · entry titles</p>
          <p className="text-page text-ink font-medium tracking-tight">
            Page · 28px · page titles
          </p>
        </div>

        <Separator className="my-6" label="Journal prose" />

        <div className="prose-journal max-w-reading">
          <p>
            The serif face is reserved for long-form journal content. It runs at
            a constrained measure with generous leading, so an entry written at
            midnight is still comfortable to read months later.
          </p>
          <p>
            Interface chrome stays sans-serif. The two never mix within a single
            block, which is what keeps the writing feeling like a document
            rather than a form.
          </p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="ai" icon={<SparkIcon />}>
            AI Assist
          </Button>
          <Button variant="danger">Delete</Button>
          <Button disabled>Disabled</Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <IconButton label="Bookmark this entry">
            <BookmarkIcon />
          </IconButton>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="max-w-md space-y-5">
          <Field
            label="Title"
            hint="Leave it blank and one will be suggested."
            action={
              <Button variant="ai" size="sm" icon={<SparkIcon />}>
                Suggest
              </Button>
            }
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                placeholder="Two-sum finally clicked"
              />
            )}
          </Field>

          <Field label="Mood">
            {({ id }) => (
              <Select id={id} defaultValue="hopeful">
                <option value="motivated">Motivated</option>
                <option value="confident">Confident</option>
                <option value="confused">Confused</option>
                <option value="frustrated">Frustrated</option>
                <option value="hopeful">Hopeful</option>
              </Select>
            )}
          </Field>

          <Field label="Notes" hint="Grows as you write.">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                placeholder="What happened today?"
              />
            )}
          </Field>

          <Field label="Tags">
            {({ id }) => <TagInput id={id} value={tags} onChange={setTags} />}
          </Field>

          <Field label="Date" error="Enter a date in YYYY-MM-DD form.">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                defaultValue="16-08-2026"
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Editor controls">
        <p className="text-small text-ink-secondary mb-4">
          No borders and no background — the page is the field.
        </p>
        <Surface className="max-w-reading p-6">
          <BareInput placeholder="Untitled entry" />
          <BareTextarea
            className="mt-4"
            minRows={4}
            placeholder="Start writing…"
          />
        </Surface>
      </Section>

      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          <Tag>neutral</Tag>
          <Tag tone="accent">accent</Tag>
          <Tag tone="ai">ai</Tag>
          <Tag tone="success">solved</Tag>
          <Tag tone="warning">in progress</Tag>
          <Tag tone="danger">stuck</Tag>
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="grid gap-4 sm:grid-cols-3">
          <Surface>
            <p className="text-small text-ink-secondary">Sunken (default)</p>
          </Surface>
          <Surface bordered>
            <p className="text-small text-ink-secondary">Bordered</p>
          </Surface>
          <Surface raised>
            <p className="text-small text-ink-secondary">Raised</p>
          </Surface>
        </div>
      </Section>

      <Section title="Overlays and feedback">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button onClick={() => show("Saved 14:32")}>Toast</Button>
          <Button onClick={() => show("Entry saved", "success")}>
            Success toast
          </Button>
          <Button onClick={() => show("AI couldn't complete this.", "danger")}>
            Error toast
          </Button>
        </div>

        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="AI Reflection"
          description="Reads today's entry and your 5 most recent entries."
          footer={
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => setSheetOpen(false)}>
                Ignore
              </Button>
              <Button size="sm" variant="primary">
                Accept
              </Button>
            </div>
          }
        >
          <p className="text-small text-ink-secondary">
            A bottom sheet on mobile, a right panel on desktop. Escape closes
            it, focus is trapped inside, and the background is inert — all
            native <code className="font-mono">&lt;dialog&gt;</code> behaviour.
          </p>
        </Sheet>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Delete this entry?"
          footer={
            <>
              <Button size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setDialogOpen(false);
                  show("Entry deleted", "danger");
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          This removes the entry and its media from disk. It cannot be undone.
        </Dialog>
      </Section>

      <Section title="Loading and empty">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-48" />
            <SkeletonText lines={3} />
          </div>

          <Surface>
            <EmptyState
              title="No entries yet"
              description="Your first entry starts the timeline."
              action={
                <Button variant="primary">Write today&rsquo;s entry</Button>
              }
            />
          </Surface>
        </div>
      </Section>
    </div>
  );
}

function SparkIcon() {
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
      <path d="M8 2l1.2 3.3L12.5 6.5l-3.3 1.2L8 11 6.8 7.7 3.5 6.5l3.3-1.2z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 2.5h8v11l-4-3-4 3z" />
    </svg>
  );
}
