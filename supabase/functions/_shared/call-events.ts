export const FINAL_CALL_STATUSES = ["completed", "failed", "no_answer", "busy", "voicemail"];

export function providerResult(p: Record<string, string>, leg: string) {
  const statusMap: Record<string, string> = { completed: "completed", busy: "busy", "no-answer": "no_answer", canceled: "no_answer", failed: "failed", ringing: "ringing", "in-progress": "answered", queued: "queued" };
  const raw = p.DialCallStatus ?? p.CallStatus;
  const machine = p.AnsweredBy?.startsWith("machine");
  // Answering the advisor leg is not evidence that the prospect answered.
  if (leg === "advisor" && ["ringing", "in-progress", "completed"].includes(raw)) return null;
  // AMD puede avisar «machine» mientras la llamada sigue en curso. No es su cierre:
  // el evento final DialCallStatus debe conservar la duración y permitir que una
  // persona tome la llamada después del filtro automático.
  const status = machine && raw === "in-progress" ? "answered" : machine ? "voicemail" : statusMap[raw];
  if (!status) return null;
  const duration = Number(p.DialCallDuration ?? p.CallDuration ?? p.Duration);
  return { status, duration: Number.isFinite(duration) ? duration : null };
}

export function inboundDialResult(p: Record<string, string>, accepted: boolean) {
  const result = providerResult(p, "inbound-advisor");
  if (!result) return null;
  if (result.status === "completed" && (!accepted || !result.duration)) return { ...result, status: "no_answer" };
  return result;
}