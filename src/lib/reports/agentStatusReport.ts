export type AgentStatusLogRow = {
  id: string; user_id: string; kind: string; reason_name: string;
  started_at: string; ended_at: string | null; set_by: string | null; ended_by?: string | null; end_cause?: string | null;
};
export type AgentSummary = {
  user_id: string; firstConnection: string | null; lastDisconnection: string | null;
  availableMin: number; pauseMin: number; byReason: Record<string, number>; exceeded: number; occupancy: number;
};

const TZ = "America/Mexico_City";
export const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleString("es-MX", { timeZone: TZ, day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "En curso";
export const minutesBetween = (a: string, b: string | null, now = Date.now()) => Math.max(0, Math.round(((b ? Date.parse(b) : now) - Date.parse(a)) / 60000));

/** Clips each segment to [from,to] so a period only counts its own minutes. */
export function buildAgentSummary(rows: AgentStatusLogRow[], range: { from: Date; to: Date }, maxByReason: Record<string, number | null> = {}, now = Date.now()): AgentSummary[] {
  const map = new Map<string, AgentSummary>();
  const end = Math.min(range.to.getTime(), now);
  for (const r of [...rows].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const s = Math.max(Date.parse(r.started_at), range.from.getTime());
    const e = Math.min(r.ended_at ? Date.parse(r.ended_at) : now, end);
    const m = map.get(r.user_id) ?? { user_id: r.user_id, firstConnection: null, lastDisconnection: null, availableMin: 0, pauseMin: 0, byReason: {}, exceeded: 0, occupancy: 0 };
    const min = e > s ? Math.round((e - s) / 60000) : 0;
    if (r.kind !== "offline") {
      if (!m.firstConnection) m.firstConnection = r.started_at;
    } else if (m.firstConnection) m.lastDisconnection = r.started_at;
    if (r.kind === "available") m.availableMin += min;
    if (r.kind === "pause") {
      m.pauseMin += min;
      m.byReason[r.reason_name] = (m.byReason[r.reason_name] ?? 0) + min;
      const max = maxByReason[r.reason_name];
      if (max && minutesBetween(r.started_at, r.ended_at, now) > max) m.exceeded += 1;
    }
    map.set(r.user_id, m);
  }
  for (const m of map.values()) {
    const total = m.availableMin + m.pauseMin;
    m.occupancy = total ? Math.round((m.availableMin / total) * 100) : 0;
  }
  return [...map.values()];
}

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
export function buildAgentStatusCSV(rows: AgentStatusLogRow[], summary: AgentSummary[], names: Map<string, string>, now = Date.now()) {
  const n = (id: string | null | undefined) => id ? names.get(id) ?? "Usuario" : "Sistema";
  const lines = ["Bitácora de estados", ["Asesor", "Estado", "Tipo", "Inicio", "Fin", "Minutos", "Cambiado por", "Motivo de cierre"].map(esc).join(",")];
  for (const r of rows) lines.push([n(r.user_id), r.reason_name, r.kind, fmtTime(r.started_at), fmtTime(r.ended_at), minutesBetween(r.started_at, r.ended_at, now), n(r.set_by), r.end_cause ?? ""].map(esc).join(","));
  lines.push("", "Resumen por asesor", ["Asesor", "Primera conexión", "Última desconexión", "Min disponible", "Min en pausa", "% disponible", "Pausas excedidas", "Detalle pausas"].map(esc).join(","));
  for (const s of summary) lines.push([n(s.user_id), fmtTime(s.firstConnection), s.lastDisconnection ? fmtTime(s.lastDisconnection) : "", s.availableMin, s.pauseMin, s.occupancy, s.exceeded, Object.entries(s.byReason).map(([k, v]) => `${k}: ${v} min`).join("; ")].map(esc).join(","));
  return lines.join("\n");
}
