import { Page, PageHeader } from "@/components/shell/app-shell";
import { InsightsReport } from "@/components/ai/reports";
import { EmptyState } from "@/components/ui/surface";
import { isAiConfigured } from "@/lib/env";

export const metadata = { title: "Learning Insights" };

export default function InsightsPage() {
  const configured = isAiConfigured();

  return (
    <Page>
      <PageHeader
        title="Learning Insights"
        description="Connections across months — what was hard once and is not any more."
      />

      {!configured ? (
        <EmptyState
          title="AI isn't set up yet"
          description="Add a Gemini API key to .env.local and restart. Everything else in the journal works without it."
        />
      ) : (
        <InsightsReport />
      )}
    </Page>
  );
}
