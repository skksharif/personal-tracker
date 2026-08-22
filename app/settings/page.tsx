import { Page, PageHeader } from "@/components/shell/app-shell";
import { JourneyForm, RebuildIndex } from "@/components/journey/journey-form";
import { AiCheck } from "@/components/settings/ai-check";
import { Separator } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { isAiConfigured } from "@/lib/env";
import { getIndex } from "@/lib/storage/index-store";
import { getOrCreateJourney } from "@/lib/storage/journey";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [journey, index] = await Promise.all([
    getOrCreateJourney(),
    getIndex(),
  ]);

  return (
    <Page>
      <PageHeader title="Settings" />

      <JourneyForm journey={journey} />

      <Separator className="my-section" />

      <section>
        <h2 className="text-title text-ink">AI</h2>
        <p className="text-small text-ink-secondary mt-1 mb-4">
          Gemini is the only external service this app uses. Your journal stays
          on this machine except for the specific text an AI action sends, and
          every action says what it sends before it runs.
        </p>
        <AiCheck configured={isAiConfigured()} />
      </section>

      <Separator className="my-section" />

      <section>
        <h2 className="text-title text-ink">Data</h2>

        <dl className="text-small mt-4 space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Indexed entries</dt>
            <dd className="text-ink tabular-nums">{index.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">AI</dt>
            <dd className="text-ink">
              {isAiConfigured() ? "Configured" : "Not configured"}
            </dd>
          </div>
        </dl>

        <p className="text-small text-ink-muted mt-6">
          Everything you write lives in <code className="font-mono">data/</code>{" "}
          as plain JSON and Markdown. The index is a cache built from those
          files — rebuild it if it ever looks out of step.
        </p>

        <div className="mt-4">
          <RebuildIndex />
        </div>
      </section>

      <Separator className="my-section" />

      <section>
        <h2 className="text-title text-ink">Export</h2>
        <p className="text-small text-ink-secondary mt-1">
          Download the whole journey as a zip: every entry as Markdown, every
          record as JSON, every image as it was stored, plus a README explaining
          the layout. It opens in any file browser — this app is not needed to
          read it.
        </p>

        {/*
          A plain link rather than a button: the route streams the archive, so
          the browser's own download handling is the right mechanism and works
          with JavaScript disabled.
        */}
        <a
          href="/api/export"
          download
          className={cn(
            "text-small mt-4 inline-flex h-11 items-center gap-2 rounded-md px-4 font-medium",
            "bg-surface text-ink border-control-border hover:bg-surface-sunken hover:border-ink-faint",
            "border transition-colors",
          )}
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M3.5 14v1.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V14" />
          </svg>
          Download everything
        </a>
      </section>
    </Page>
  );
}
