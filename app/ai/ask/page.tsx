import { Page, PageHeader } from "@/components/shell/app-shell";
import { AskJourney } from "@/components/ai/ask";
import { EmptyState } from "@/components/ui/surface";
import { isAiConfigured } from "@/lib/env";

export const metadata = { title: "Ask My Journey" };

export default function AskPage() {
  const configured = isAiConfigured();

  return (
    <Page>
      <PageHeader
        title="Ask My Journey"
        description="Ask a question about your own record. Answered only from what you have written."
      />

      {!configured ? (
        <EmptyState
          title="AI isn't set up yet"
          description="Add a Gemini API key to .env.local and restart. Everything else in the journal works without it."
        />
      ) : (
        <AskJourney />
      )}
    </Page>
  );
}
