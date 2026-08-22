"use server";

import { revalidatePath } from "next/cache";

import {
  NOTE_CONFIG,
  createNote,
  deleteNote,
  updateNote,
  type NoteInput,
} from "@/lib/storage/notes";
import type { NoteKind, TopicStatus } from "@/lib/technical";
import {
  addAttempt,
  createProblem,
  deleteProblem,
  updateProblem,
  type Attempt,
  type ProblemInput,
} from "@/lib/storage/problems";
import {
  createSession,
  deleteSession,
  updateSession,
  type SessionInput,
} from "@/lib/storage/sessions";
import { saveTopic } from "@/lib/storage/topics";
import { toActionState, type ActionResult } from "@/app/actions/shared";

/**
 * Technical preparation mutations.
 *
 * DSA is revalidated on every problem write because its counts are derived
 * from problem records rather than stored — the page is only ever as fresh as
 * the last revalidation.
 */
function revalidateTechnical() {
  revalidatePath("/");
  revalidatePath("/journey/timeline");
  revalidatePath("/journey/progress");
  revalidatePath("/technical/problems");
  revalidatePath("/technical/dsa");
}

/* -------------------------------------------------------------------------- */
/* Problems                                                                   */
/* -------------------------------------------------------------------------- */

export async function createProblemAction(
  input: ProblemInput,
): Promise<ActionResult & { id?: string }> {
  try {
    const problem = await createProblem(input);
    revalidateTechnical();
    return { status: "success", message: "Problem added", id: problem.id };
  } catch (error) {
    return toActionState(error);
  }
}

export async function saveProblemAction(
  id: string,
  input: Partial<ProblemInput>,
): Promise<ActionResult> {
  try {
    await updateProblem(id, input);
    revalidateTechnical();
    revalidatePath(`/technical/problems/${id}`);
    return { status: "success", message: "Saved" };
  } catch (error) {
    return toActionState(error);
  }
}

export async function addAttemptAction(
  id: string,
  attempt: Attempt,
): Promise<ActionResult> {
  try {
    await addAttempt(id, attempt);
    revalidateTechnical();
    revalidatePath(`/technical/problems/${id}`);
    return { status: "success", message: "Attempt recorded" };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteProblemAction(id: string): Promise<ActionResult> {
  try {
    await deleteProblem(id);
    revalidateTechnical();
    return { status: "success", message: "Problem deleted" };
  } catch (error) {
    return toActionState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Topics                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveTopicAction(
  id: string,
  input: { name?: string; status?: TopicStatus; notes?: string },
): Promise<ActionResult> {
  try {
    await saveTopic(id, input);
    revalidatePath("/technical/dsa");
    revalidatePath(`/technical/dsa/${id}`);
    return { status: "success", message: "Saved" };
  } catch (error) {
    return toActionState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Notes, fundamentals and designs                                            */
/* -------------------------------------------------------------------------- */

function revalidateNotes(kind: NoteKind, id?: string) {
  revalidatePath("/");
  revalidatePath("/journey/timeline");
  revalidatePath(NOTE_CONFIG[kind].href("").replace(/\/$/, ""));
  if (id) revalidatePath(NOTE_CONFIG[kind].href(id));
}

export async function createNoteAction(
  kind: NoteKind,
  input: NoteInput = {},
): Promise<ActionResult & { id?: string }> {
  try {
    const note = await createNote(kind, input);
    revalidateNotes(kind, note.id);
    return { status: "success", message: "Created", id: note.id };
  } catch (error) {
    return toActionState(error);
  }
}

export interface SaveNoteResult {
  status: "success" | "error";
  message?: string;
  savedAt?: string;
}

/** Autosave for note bodies. Mirrors the diary editor's contract. */
export async function saveNoteAction(
  kind: NoteKind,
  id: string,
  input: NoteInput,
): Promise<SaveNoteResult> {
  try {
    const note = await updateNote(kind, id, input);
    revalidateNotes(kind, id);
    return { status: "success", savedAt: note.updatedAt };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: "Couldn't save. Your text is still here — trying again shortly.",
    };
  }
}

export async function deleteNoteAction(
  kind: NoteKind,
  id: string,
): Promise<ActionResult> {
  try {
    await deleteNote(kind, id);
    revalidateNotes(kind);
    return { status: "success", message: "Deleted" };
  } catch (error) {
    return toActionState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

export async function createSessionAction(
  input: SessionInput,
): Promise<ActionResult> {
  try {
    await createSession(input);
    revalidatePath("/technical/sessions");
    revalidatePath("/");
    revalidatePath("/journey/timeline");
    return { status: "success", message: "Session recorded" };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateSessionAction(
  id: string,
  input: Partial<SessionInput>,
): Promise<ActionResult> {
  try {
    await updateSession(id, input);
    revalidatePath("/technical/sessions");
    return { status: "success", message: "Saved" };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  try {
    await deleteSession(id);
    revalidatePath("/technical/sessions");
    revalidatePath("/journey/timeline");
    return { status: "success", message: "Session deleted" };
  } catch (error) {
    return toActionState(error);
  }
}
