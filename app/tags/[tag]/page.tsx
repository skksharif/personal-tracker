import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryList } from "@/components/organise/entry-list";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { recordsWithTag } from "@/lib/storage/tags";

export async function generateMetadata({ params }: PageProps<"/tags/[tag]">) {
  const { tag } = await params;
  return { title: decodeURIComponent(tag) };
}

/** Everything carrying one tag, newest first. */
export default async function TagPage({ params }: PageProps<"/tags/[tag]">) {
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw);

  const records = await recordsWithTag(tag);

  // A tag with nothing on it does not exist — the registry is derived, so
  // there is no empty tag to show a page for.
  if (records.length === 0) notFound();

  return (
    <Page>
      <PageHeader
        meta={
          <Link href="/tags" className="hover:text-ink transition-colors">
            ← All tags
          </Link>
        }
        title={tag}
        description={`${records.length} ${records.length === 1 ? "entry carries" : "entries carry"} this tag.`}
        action={
          <Link href={`/search?tag=${encodeURIComponent(tag)}`}>
            <Button size="sm">Search within</Button>
          </Link>
        }
      />

      <EntryList records={records} />
    </Page>
  );
}
