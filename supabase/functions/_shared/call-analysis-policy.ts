/** Only exact non-conversation transcripts are skipped; uncertainty always reaches AI. */
export function nonConversationReason(text: string): "silence" | "greeting" | "voicemail" | null {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[.,!¡?¿:;]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || /^(?:\[?silencio\]?|\[?sin audio\]?|\[?inaudible\]?|\[?musica\]?)$/.test(normalized)) return "silence";
  if (/^(?:hola|bueno|buenos dias|buenas tardes|buenas noches)(?: (?:hola|bueno|buenos dias|buenas tardes|buenas noches))*$/.test(normalized)) return "greeting";
  if (/^(?:el numero que usted marco no esta disponible|el usuario no se encuentra disponible|su llamada sera transferida al buzon de voz|bienvenido al buzon de voz)(?: (?:por favor )?deje (?:su|un) mensaje (?:despues del tono|al escuchar el tono))?$/.test(normalized)) return "voicemail";
  return null;
}

const NON_CONVERSATION_STATUSES = new Set(["voicemail", "no_answer", "busy", "failed"]);

/** La conversación confirmada corrige un falso intento, pero exige evidencia de conexión. */
export function conversationStatusPatch(
  call: { status?: string | null; answered_at?: string | null; duration_seconds?: number | null },
  leadParticipated: boolean,
): Record<string, string> {
  const connected = !!call.answered_at || Number(call.duration_seconds) > 0;
  if (!leadParticipated || !connected || !NON_CONVERSATION_STATUSES.has(call.status ?? "")) return {};
  return { status: "completed" };
}

export async function transcriptFingerprint(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.trim().replace(/\s+/g, " "));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

type Field = { key: string; label: string };
type Outcome = { id: string; label: string };
type Typification = { id: string; label: string; sentiment: string; outcome_id: string | null };
/** Local aliases reduce UUID repetition; labels and catalog relationships stay intact. */
export function compactCallCatalog(fields: Field[], outcomes: Outcome[], typs: Typification[]) {
  const fieldMap = new Map(fields.map((f, i) => [`f${i}`, f.key]));
  const outcomeMap = new Map(outcomes.map((o, i) => [`o${i}`, o.id]));
  const typMap = new Map(typs.map((t, i) => [`t${i}`, t.id]));
  const outcomeAliases = new Map(outcomes.map((o, i) => [o.id, `o${i}`]));
  const catalog = JSON.stringify({
    campos: fields.map((f, i) => [`f${i}`, f.label]),
    resultados: outcomes.map((o, i) => [`o${i}`, o.label]),
    tipificaciones: typs.map((t, i) => [`t${i}`, t.outcome_id ? outcomeAliases.get(t.outcome_id) : null, t.label, t.sentiment]),
  });
  return { catalog, fieldMap, outcomeMap, typMap };
}