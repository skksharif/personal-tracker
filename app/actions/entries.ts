"use server";

import { revalidatePath } from "next/cache";

import {
  ENTRY_CONFIG,
  createEntry,
  deleteEntry,
  updateEntry,
  type EntryInput,
  type WrittenEntryType,
} from "@/lib/storage/entries";
import { toActionState, type ActionResult } from "@/app/actions/shared";

function revalidateEntry(type: WrittenEntryType, id?: string) {
  revalidatePath("/");
  revalidatePath("/journey/timeline");
  revalidatePath("/journey/progress");
  revalidatePath("/diary");
  revalidatePath("/diary/emotions");
  revalidatePath("/diary/media");

  const listPath = ENTRY_CONFIG[type].href("").replace(/\/$/, "");
  if (listPath) revalidatePath(listPath);
  if (id) revalidatePath(ENTRY_CONFIG[type].href(id));
}

export interface SaveEntryResult extends Record<string, unknown> {
  status: "success" | "error";
  message?: string;
  savedAt?: string;
}

/**
 * Autosave.
 *
 * Called on a debounce while the user is still typing, so it upserts: opening
 * a date that has never been written to and typing one character has to
 * succeed, not fail with "no such entry".
 *
 * Returns a plain result rather than throwing. A failed save must leave the
 * editor exactly as it was, with the text still on screen.
 */
export async function saveEntryAction(
  type: WrittenEntryType,
  id: string,
  input: EntryInput,
): Promise<SaveEntryResult> {
  try {
    const entry = await updateEntry(type, id, input);
    revalidateEntry(type, id);
    return { status: "success", savedAt: entry.updatedAt };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: "Couldn't save. Your text is still here — trying again shortly.",
    };
  }
}

/** Create a non-diary entry, which needs an id generated from its title. */
export async function createEntryAction(
  type: WrittenEntryType,
  input: EntryInput,
): Promise<ActionResult & { id?: string }> {
  try {
    const entry = await createEntry(type, input);
    revalidateEntry(type, entry.id);
    return { status: "success", message: "Created", id: entry.id };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteEntryAction(
  type: WrittenEntryType,
  id: string,
): Promise<ActionResult> {
  try {
    await deleteEntry(type, id);
    revalidateEntry(type, id);
    return { status: "success", message: "Entry deleted" };
  } catch (error) {
    return toActionState(error);
  }
}
