"use server";

import { runDiagnostics, type Diagnostics } from "@/lib/ai/diagnostics";

/**
 * Kept apart from `ai.ts` so the diagnostics module — which imports the
 * server-only Gemini client — is not pulled toward the browser by a Client
 * Component importing the `Diagnostics` type.
 */
export async function runDiagnosticsAction(): Promise<Diagnostics> {
  return runDiagnostics();
}
