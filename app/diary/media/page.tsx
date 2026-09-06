import Link from "next/link";

import { DeleteMediaButton } from "@/components/diary/delete-media";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/surface";
import { formatDay } from "@/lib/dates";
import {
  ENTRY_CONFIG,
  isSealed,
  listEntries,
  type Media,
  type WrittenEntryType,
} from "@/lib/storage/entries";
import { today } from "@/lib/dates";

export const metadata = { title: "Memory & Media" };

interface MediaItem {
  media: Media;
  href: string;
  date: string;
  title: string;
  /** The entry that owns the image — deleting it has to go through there. */
  type: WrittenEntryType;
  entryId: string;
}

/**
 * Every image in the journal, newest first.
 *
 * A way back into the entries rather than a gallery in its own right — each
 * image links to the entry it belongs to, because that is where its meaning
 * lives.
 */
export default async function MediaPage() {
  const types = Object.keys(ENTRY_CONFIG) as WrittenEntryType[];
  const collections = await Promise.all(types.map((type) => listEntries(type)));

  const now = today();
  const items: MediaItem[] = [];

  for (const entries of collections) {
    for (const entry of entries) {
      // A sealed letter's images stay sealed with it.
      if (isSealed(entry, now)) continue;

      for (const media of entry.media) {
        items.push({
          media,
          href: ENTRY_CONFIG[entry.type].href(entry.id),
          date: entry.date,
          title: entry.title || ENTRY_CONFIG[entry.type].defaultTitle,
          type: entry.type,
          entryId: entry.id,
        });
      }
    }
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <Page>
      <PageHeader
        meta={`${items.length} ${items.length === 1 ? "image" : "images"}`}
        title="Memory & Media"
        description="Everything you've added to an entry. Deleting one here removes it from the entry too."
      />

      {items.length === 0 ? (
        <EmptyState
          title="No images yet"
          description="Add one from inside an entry — a screenshot, a diagram, a photo of where you were sitting."
          action={
            <Link
              href="/diary"
              className="text-small text-accent underline underline-offset-4"
            >
              Go to the diary
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item, position) => (
            <li key={`${item.media.path}-${position}`} className="relative">
              <Link href={item.href} className="group block">
                {/* eslint-disable-next-line @next/next/no-img-element -- local upload, sized by the stored record */}
                <img
                  src={item.media.path}
                  alt={item.media.alt}
                  width={item.media.width}
                  height={item.media.height}
                  loading="lazy"
                  className="bg-surface-sunken aspect-square w-full rounded object-cover transition-opacity group-hover:opacity-90"
                />
                <p className="text-meta text-ink-muted mt-1.5 truncate">
                  {formatDay(item.date)}
                </p>
                <p className="text-meta text-ink group-hover:text-accent truncate transition-colors">
                  {item.title}
                </p>
                {item.media.generated ? (
                  <p className="text-meta text-ink-faint">AI-generated</p>
                ) : null}
              </Link>

              {/*
                Outside the link, or a click meant for delete would navigate.
                Always visible rather than hover-only: this is the page people
                come to precisely to clear something out, and a control that
                only exists on hover does not exist on a phone.
              */}
              <div className="bg-surface/85 absolute top-1 right-1 rounded backdrop-blur-sm">
                <DeleteMediaButton
                  type={item.type}
                  entryId={item.entryId}
                  entryTitle={item.title}
                  mediaPath={item.media.path}
                  alt={item.media.alt}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
