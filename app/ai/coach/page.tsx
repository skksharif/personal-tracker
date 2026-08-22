import { Page, PageHeader } from "@/components/shell/app-shell";
import { CoachReport } from "@/components/ai/reports";
import { EmptyState } from "@/components/ui/surface";
import { isAiConfigured } from "@/lib/env";

export const metadata = { title: "Personal Coach" };

export default function CoachPage() {
  const configured = isAiConfigured();

  return (
    <Page>
      <PageHeader
        title="Personal Coach"
        description="One thing worth doing next, and why — from what you have actually recorded."
      />

      {!configured ? (
        <EmptyState
          title="AI isn't set up yet"
          description="Add a Gemini API key to .env.local and restart. Everything else in the journal works without it."
        />
      ) : (
        <CoachReport />
      )}
    </Page>
  );
}
