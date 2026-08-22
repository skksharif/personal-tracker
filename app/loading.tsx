import { Page } from "@/components/shell/app-shell";
import { Skeleton, SkeletonText } from "@/components/ui/surface";

export default function Loading() {
  return (
    <Page>
      <div className="mb-section space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64" />
      </div>
      <SkeletonText lines={4} />
    </Page>
  );
}
