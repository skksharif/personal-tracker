/**
 * The bar that says a page is on its way.
 *
 * Rendered from `loading.tsx`, which is the one place that knows a route
 * transition is in flight — no hook, no client component, no state to keep in
 * step. It appears when the loading boundary appears and vanishes when the
 * page swaps in, because it is part of that boundary.
 *
 * `aria-hidden` on purpose: the skeleton beneath it already carries a live
 * "Loading" announcement, and two announcements for one event is noise.
 */
export function RouteProgress() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <div className="route-progress bg-accent h-full" />
    </div>
  );
}
