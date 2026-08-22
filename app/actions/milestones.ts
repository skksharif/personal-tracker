"use server";

import { revalidatePath } from "next/cache";

import {
  createMilestone,
  deleteMilestone,
  updateMilestone,
} from "@/lib/storage/milestones";
import { field, toActionState, type ActionResult } from "@/app/actions/shared";

/**
 * Milestone mutations.
 *
 * Every path that shows milestones is revalidated after a write, so the
 * timeline and home page reflect the change immediately rather than on the
 * next hard refresh.
 */
function revalidateJourney() {
  revalidatePath("/");
  revalidatePath("/journey/timeline");
  revalidatePath("/journey/milestones");
  revalidatePath("/journey/progress");
}

export async function createMilestoneAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createMilestone({
      date: field(formData, "date") ?? "",
      title: field(formData, "title") ?? "",
      note: field(formData, "note") ?? "",
    });

    revalidateJourney();
    return { status: "success", message: "Milestone added" };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateMilestoneAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const id = field(formData, "id");
    if (!id) throw new Error("Missing milestone id");

    await updateMilestone(id, {
      date: field(formData, "date") ?? "",
      title: field(formData, "title") ?? "",
      note: field(formData, "note") ?? "",
    });

    revalidateJourney();
    return { status: "success", message: "Milestone updated" };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteMilestoneAction(id: string): Promise<ActionResult> {
  try {
    await deleteMilestone(id);
    revalidateJourney();
    return { status: "success", message: "Milestone deleted" };
  } catch (error) {
    return toActionState(error);
  }
}
