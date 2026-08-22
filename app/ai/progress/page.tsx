import { Page, PageHeader } from "@/components/shell/app-shell";
import { ProgressReport } from "@/components/ai/reports";
import { EmptyState } from "@/components/ui/surface";
import { isAiConfigured } from "@/lib/env";

export const metadata = { title: "Progress Analysis" };

export default function ProgressAiPage() {
  const configured = isAiConfigured();

  return (
    <Page>
      <PageHeader
        title="Progress Analysis"
        description="The part the numbers cannot cover: how the preparation has changed."
      />

      {!configured ? (
        <EmptyState
          title="AI isn't set up yet"
          description="Add a Gemini API key to .env.local and restart. Everything else in the journal works without it."
        />
      ) : (
        <ProgressReport />
      )}
    </Page>
  );
}
