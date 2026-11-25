/** Reuse only a matching, still-active result with unchanged advisor context. */
export function storedCallTypification(
  call: { ai_summary?: string | null; ai_suggestions?: Record<string, unknown> | null },
  outcomeId: string, note: string, activeIds: string[],
): string | null {
  const suggestion = call.ai_suggestions;
  const id = suggestion?.typification_id;
  if (suggestion?.outcome_id !== outcomeId || typeof id !== "string" || !activeIds.includes(id)) return null;
  if (note.trim() && note.trim() !== String(call.ai_summary ?? "").trim().slice(0, 1000)) return null;
  return id;
}