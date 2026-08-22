import { Page, PageHeader } from "@/components/shell/app-shell";
import { DesignSystemDemo } from "@/app/design/demo";

export const metadata = { title: "Design system" };

/**
 * Living reference for the design system. Every primitive rendered once, so
 * a token change can be judged in both themes without hunting through the app.
 */
export default function DesignPage() {
  return (
    <Page>
      <PageHeader
        meta="Phase 1"
        title="Design system"
        description="Every primitive, in one place. Switch the theme in the navigation to check both palettes."
      />
      <DesignSystemDemo />
    </Page>
  );
}
