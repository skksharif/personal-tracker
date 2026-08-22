"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { NAV_AREAS, activeArea, isCurrent } from "@/lib/navigation";
import { NavIcon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/theme-toggle";

/**
 * Bottom navigation, mobile only.
 *
 * Five areas, thumb-reachable, each a 56px target. Sits above the safe-area
 * inset so the home indicator on iOS does not overlap it.
 */
export function BottomNav() {
  const pathname = usePathname();
  const current = activeArea(pathname);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "border-line bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur",
        "pb-[env(safe-area-inset-bottom)] lg:hidden",
      )}
    >
      <ul className="flex">
        {NAV_AREAS.map((area) => {
          const active = current?.id === area.id;
          return (
            <li key={area.id} className="flex-1">
              <Link
                href={area.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5",
                  "text-[0.6875rem] transition-colors",
                  active
                    ? "text-accent"
                    : "text-ink-muted hover:text-ink-secondary",
                )}
              >
                <NavIcon name={area.icon} />
                {area.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Left rail, desktop only.
 *
 * Shows the five areas, and expands the current one to its sections — enough
 * structure to navigate without a permanently open tree of thirty links.
 */
export function SideNav() {
  const pathname = usePathname();
  const current = activeArea(pathname);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "border-line hidden w-56 shrink-0 border-r lg:block",
        "sticky top-0 h-dvh overflow-y-auto px-3 py-6",
      )}
    >
      <Link
        href="/"
        className="text-meta text-ink mb-8 block px-3 leading-snug font-medium"
      >
        My Amazon
        <br />
        SDE Journey
      </Link>

      <ul className="space-y-0.5">
        {NAV_AREAS.map((area) => {
          const active = current?.id === area.id;
          return (
            <li key={area.id}>
              <Link
                href={area.href}
                aria-current={
                  isCurrent(area.href, pathname) ? "page" : undefined
                }
                className={cn(
                  "text-small flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
                  active
                    ? "bg-surface-sunken text-ink font-medium"
                    : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
                )}
              >
                <NavIcon name={area.icon} />
                {area.label}
              </Link>

              {active ? (
                <ul className="border-line mt-0.5 mb-2 ml-[1.6rem] space-y-0.5 border-l pl-3">
                  {area.sections.map((section) => (
                    <li key={section.href}>
                      <Link
                        href={section.href}
                        aria-current={
                          isCurrent(section.href, pathname) ? "page" : undefined
                        }
                        className={cn(
                          "text-meta block rounded px-2 py-1.5 transition-colors",
                          isCurrent(section.href, pathname)
                            ? "text-accent"
                            : "text-ink-muted hover:text-ink",
                        )}
                      >
                        {section.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-8 px-3">
        <ThemeToggle />
      </div>
    </nav>
  );
}

/**
 * Compact header, mobile only. Carries the current area name and the theme
 * control, which have no home in the bottom bar.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const current = activeArea(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-3",
        "border-line bg-canvas/95 border-b px-4 backdrop-blur lg:hidden",
      )}
    >
      <span className="text-small text-ink font-medium">
        {current?.label ?? "My Amazon SDE Journey"}
      </span>
      <ThemeToggle />
    </header>
  );
}
