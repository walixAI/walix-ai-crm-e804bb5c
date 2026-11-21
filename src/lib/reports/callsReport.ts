import { isEffectiveCall } from "@/lib/activities/consolidateCalls";
import { isMissedInbound } from "@/lib/activities/inboundCalls";

/** Fila de la tabla `calls` ya leída con el nombre del responsable. */
export interface CallsReportRow {
  id: string;
  direction: string;
  status: string;
  duration_seconds: number | null;
  answered_at: string | null;
  ended_at?: string | null;
  hangup_by?: string | null;
  hangup_at?: string | null;
  created_at: string;
  user_id: string | null;
  contact_id: string | null;
  from_number?: string | null;
  to_number?: string | null;
  outcome?: string | null;
  ai_summary?: string | null;
  advisorName?: string | null;
}

export interface DirectionSummary {
  /** Llamadas marcadas en el periodo. */
  total: number;
  /** Hubo conversación real. */
  effective: number;
  /** No llegaron a una conversación. */
  attempts: number;
  /** Efectivas sobre el total, 0-100. */
  rate: number;
  /** Promedio de intentos por cada llamada efectiva; "—" si no hay efectivas. */
  perEffective: string;
}

export interface InboundSummary {
  received: number;
  answered: number;
  missed: number;
  /** Atendidas sobre recibidas, 0-100. */
  attentionRate: number;
}

export interface AdvisorCallRow {
  key: string;
  advisorId: string | null;
  advisorName: string;
  outboundTotal: number;
  outboundEffective: number;
  outboundRate: number;
  inboundReceived: number;
  inboundAnswered: number;
  inboundMissed: number;
  /** Última llamada del responsable dentro del periodo. */
  lastActivity: string | null;
}

export interface CallsReport {
  outbound: DirectionSummary;
  inbound: InboundSummary;
  byAdvisor: AdvisorCallRow[];
}

const UNASSIGNED_LABEL = "Grupo de recepción · sin asignar";

function percent(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

function summarizeOutbound(rows: CallsReportRow[]): DirectionSummary {
  const effective = rows.filter((c) => isEffectiveCall(
    { status: c.status, duration: c.duration_seconds },
    c.ai_summary ?? "",
  )).length;
  const attempts = rows.length - effective;
  return {
    total: rows.length,
    effective,
    attempts,
    rate: percent(effective, rows.length),
    perEffective: effective ? (attempts / effective).toFixed(1) : "—",
  };
}

function summarizeInbound(rows: CallsReportRow[]): InboundSummary {
  const answered = rows.filter((c) => !!c.answered_at).length;
  const missed = rows.filter((c) => isMissedInbound(c)).length;
  return {
    received: rows.length,
    answered,
    missed,
    attentionRate: percent(answered, rows.length),
  };
}

function summarizeAdvisors(rows: CallsReportRow[]): AdvisorCallRow[] {
  const groups = new Map<string, CallsReportRow[]>();
  for (const row of rows) {
    const key = row.user_id ?? "unassigned";
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const result: AdvisorCallRow[] = [];
  for (const [key, bucket] of groups) {
    const outbound = bucket.filter((c) => c.direction !== "inbound");
    const inbound = bucket.filter((c) => c.direction === "inbound");
    const summary = summarizeOutbound(outbound);
    const advisorId = key === "unassigned" ? null : key;
    const named = bucket.find((c) => c.advisorName && c.advisorName !== UNASSIGNED_LABEL)?.advisorName;
    result.push({
      key,
      advisorId,
      advisorName: advisorId ? (named ?? "Asesor asignado") : UNASSIGNED_LABEL,
      outboundTotal: outbound.length,
      outboundEffective: summary.effective,
      outboundRate: summary.rate,
      inboundReceived: inbound.length,
      inboundAnswered: inbound.filter((c) => !!c.answered_at).length,
      inboundMissed: inbound.filter((c) => isMissedInbound(c)).length,
      lastActivity: bucket
        .map((c) => c.created_at)
        .sort()
        .at(-1) ?? null,
    });
  }

  return result.sort((a, b) => (
    (b.outboundTotal + b.inboundReceived) - (a.outboundTotal + a.inboundReceived)
    || a.advisorName.localeCompare(b.advisorName, "es")
  ));
}

/**
 * Resume el historial de llamadas del periodo visible: salientes por responsable,
 * entrantes atendidas y no atendidas. Las filas ya vienen filtradas por RLS.
 */
export function buildCallsReport(rows: CallsReportRow[]): CallsReport {
  const outbound = rows.filter((c) => c.direction !== "inbound");
  const inbound = rows.filter((c) => c.direction === "inbound");
  return {
    outbound: summarizeOutbound(outbound),
    inbound: summarizeInbound(inbound),
    byAdvisor: summarizeAdvisors(rows),
  };
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[,",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values: (string | number)[]): string {
  return values.map(csvCell).join(",");
}

/** CSV del reporte: resumen por responsable y detalle de entrantes no atendidas. */
export function buildCallsReportCSV(
  report: CallsReport,
  rows: CallsReportRow[],
  opts: { periodLabel: string; tenantName?: string | null },
): string {
  const lines: string[] = [
    `# ${opts.tenantName ?? "Walix"}`,
    `# Reporte de llamadas ${opts.periodLabel} · generado ${new Date().toLocaleString("es-MX")}`,
    "",
    "# Resumen",
    csvRow(["Salientes", "Marcadas", "Efectivas", "Intentos", "Tasa conexión %"]),
    csvRow(["", report.outbound.total, report.outbound.effective, report.outbound.attempts, report.outbound.rate]),
    csvRow(["Entrantes", "Recibidas", "Atendidas", "No atendidas", "Tasa atención %"]),
    csvRow(["", report.inbound.received, report.inbound.answered, report.inbound.missed, report.inbound.attentionRate]),
    "",
    "# Por responsable",
    csvRow(["Responsable", "Salientes", "Efectivas", "Tasa %", "Entrantes", "Atendidas", "No atendidas", "Última actividad"]),
    ...report.byAdvisor.map((a) => csvRow([
      a.advisorName, a.outboundTotal, a.outboundEffective, a.outboundRate,
      a.inboundReceived, a.inboundAnswered, a.inboundMissed,
      a.lastActivity ? new Date(a.lastActivity).toLocaleString("es-MX") : "",
    ])),
    "",
    "# Entrantes no atendidas",
    csvRow(["Fecha", "Número", "Responsable", "Resultado"]),
    ...rows
      .filter((c) => c.direction === "inbound" && isMissedInbound(c))
      .map((c) => csvRow([
        new Date(c.created_at).toLocaleString("es-MX"),
        c.from_number ?? c.to_number ?? "",
        c.advisorName ?? UNASSIGNED_LABEL,
        c.outcome ?? c.status,
      ])),
  ];
  return lines.join("\n");
}
