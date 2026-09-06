import { Page } from "@/components/shell/app-shell";
import { RouteProgress } from "@/components/shell/route-progress";
import { Skeleton, SkeletonText } from "@/components/ui/surface";

/**
 * What every page shows while it is being read off disk.
 *
 * Two signals, because they answer different questions. The bar at the top
 * says "your click landed"; the skeleton says "and here is roughly what is
 * coming". The shell around it stays interactive throughout — the navigation
 * belongs to the layout, not to the page.
 */
export default function Loading() {
  return (
    <>
      <RouteProgress />

      {/*
        One polite announcement for the whole transition. The skeleton blocks
        below are decorative and stay out of the accessibility tree.
      */}
      <span role="status" className="sr-only">
        Loading
      </span>

      <Page>
        <div className="mb-section space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-64" />
        </div>
        <SkeletonText lines={4} />
      </Page>
    </>
  );
}
