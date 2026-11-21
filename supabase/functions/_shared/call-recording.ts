/** Only recordings of real conversations (answered or with talk time) are downloadable. */
const NOT_CONVERSATION = new Set(["voicemail", "no_answer", "busy", "failed"]);
export function isRecordingDownloadable(c: { recording_url?: string | null; duration_seconds?: number | null; answered_at?: string | null; status?: string | null }) {
  return !!c.recording_url && !NOT_CONVERSATION.has(c.status ?? "") && ((c.duration_seconds ?? 0) > 0 || !!c.answered_at);
}
export function recordingFileName(contact: string | null, createdAt: string) {
  const slug = (contact ?? "sin-contacto").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "sin-contacto";
  const d = new Date(createdAt).toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).replace(" ", "_").replace(/:/g, "").slice(0, 15);
  return `llamada_${slug}_${d}.mp3`;
}
