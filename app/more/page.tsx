import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { cn } from "@/lib/cn";
import { bookmarkedIds } from "@/lib/storage/bookmarks";
import { getIndex } from "@/lib/storage/index-store";
import { summariseTags } from "@/lib/storage/tags";

export const metadata = { title: "More" };

/**
 * The fifth area.
 *
 * The bottom bar has five slots and the journal has more than five sections,
 * so this is where the cross-cutting ones live: the tools that work across
 * every module rather than inside one.
 */
export default async function MorePage() {
  const [index, tags, bookmarks] = await Promise.all([
    getIndex(),
    summariseTags(),
    bookmarkedIds(),
  ]);

  const links = [
    {
      href: "/search",
      label: "Search",
      description: "Find a phrase anywhere you have written it.",
      meta: `${index.length} ${index.length === 1 ? "entry" : "entries"}`,
    },
    {
      href: "/tags",
      label: "Tags",
      description: "Every tag in use, with rename and merge.",
      meta: `${tags.length} ${tags.length === 1 ? "tag" : "tags"}`,
    },
    {
      href: "/bookmarks",
      label: "Bookmarks",
      description: "The entries you starred to come back to.",
      meta: `${bookmarks.size} saved`,
    },
    {
      href: "/analytics",
      label: "Analytics",
      description: "Consistency, mood, topics and problem outcomes.",
      meta: undefined,
    },
    {
      href: "/settings",
      label: "Settings",
      description: "Your journey, the AI connection, and a full export.",
      meta: undefined,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="More"
        description="Tools that work across the whole journal rather than inside one part of it."
      />

      <ul>
        {links.map((link, position) => (
          <li key={link.href}>
            {position > 0 ? <hr className="border-line border-t" /> : null}

            <Link
              href={link.href}
              className={cn(
                "group -mx-3 flex items-baseline gap-3 rounded-md px-3 py-4",
                "hover:bg-surface-sunken transition-colors",
              )}
            >
              <div className="min-w-0 flex-1">
                <span className="text-ink group-hover:text-accent font-medium transition-colors">
                  {link.label}
                </span>
                <p className="text-small text-ink-muted mt-0.5">
                  {link.description}
                </p>
              </div>

              {link.meta ? (
                <span className="text-meta text-ink-faint shrink-0 tabular-nums">
                  {link.meta}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
