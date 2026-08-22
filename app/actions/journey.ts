"use server";

import { revalidatePath } from "next/cache";

import { rebuildIndex } from "@/lib/storage/index-store";
import { saveJourney } from "@/lib/storage/journey";
import "@/lib/storage/register";
import { field, toActionState, type ActionResult } from "@/app/actions/shared";

export async function saveJourneyAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await saveJourney({
      title: field(formData, "title") ?? "",
      startDate: field(formData, "startDate") ?? "",
      ...(field(formData, "targetDate")
        ? { targetDate: field(formData, "targetDate") }
        : {}),
      target: field(formData, "target") ?? "",
      currentFocus: field(formData, "currentFocus") ?? "",
    });

    revalidatePath("/");
    revalidatePath("/journey/progress");
    revalidatePath("/settings");
    return { status: "success", message: "Journey saved" };
  } catch (error) {
    return toActionState(error);
  }
}

/**
 * Regenerate the index from the entity files.
 *
 * Exposed in Settings because the index is a cache and caches drift — after a
 * hand-edit in `data/`, a restore from backup, or a bug. Rebuilding touches no
 * user content, so it is always safe to run.
 */
export async function rebuildIndexAction(): Promise<ActionResult> {
  try {
    const entries = await rebuildIndex();

    revalidatePath("/");
    revalidatePath("/journey/timeline");
    revalidatePath("/journey/progress");
    revalidatePath("/settings");

    return {
      status: "success",
      message: `Index rebuilt — ${entries.length} ${
        entries.length === 1 ? "entry" : "entries"
      }.`,
    };
  } catch (error) {
    return toActionState(error);
  }
}
