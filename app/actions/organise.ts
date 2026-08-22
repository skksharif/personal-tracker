"use server";

import { revalidatePath } from "next/cache";

import { toggleBookmark } from "@/lib/storage/bookmarks";
import { deleteTag, renameTag } from "@/lib/storage/tags";
import { toActionState, type ActionResult } from "@/app/actions/shared";

/**
 * Organisation mutations: bookmarks and tag maintenance.
 *
 * Renaming a tag touches every entity carrying it, so the result says how many
 * records changed rather than reporting a bare success — a rename that matched
 * nothing is worth knowing about.
 */

export async function toggleBookmarkAction(
  id: string,
): Promise<ActionResult & { bookmarked?: boolean }> {
  try {
    const bookmarked = await toggleBookmark(id);
    revalidatePath("/bookmarks");
    return {
      status: "success",
      message: bookmarked ? "Bookmarked" : "Bookmark removed",
      bookmarked,
    };
  } catch (error) {
    return toActionState(error);
  }
}

export async function renameTagAction(
  from: string,
  to: string,
): Promise<ActionResult> {
  try {
    const changed = await renameTag(from, to);

    revalidatePath("/tags");
    revalidatePath("/");
    revalidatePath("/journey/timeline");
    revalidatePath("/search");

    return {
      status: "success",
      message:
        changed === 0
          ? "Nothing changed — that tag was already named this."
          : `Renamed on ${changed} ${changed === 1 ? "entry" : "entries"}.`,
    };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteTagAction(tag: string): Promise<ActionResult> {
  try {
    const changed = await deleteTag(tag);

    revalidatePath("/tags");
    revalidatePath("/journey/timeline");
    revalidatePath("/search");

    return {
      status: "success",
      message: `Removed from ${changed} ${changed === 1 ? "entry" : "entries"}. The entries themselves are untouched.`,
    };
  } catch (error) {
    return toActionState(error);
  }
}
