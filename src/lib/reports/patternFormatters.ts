import { Calendar, Clock, Timer, AlertCircle, MessageSquare, Workflow, Trophy, Sparkles } from "lucide-react";

export const PATTERN_ICONS: Record<string, any> = {
  best_followup_day: Calendar,
  peak_response_hours: Clock,
  avg_close_days: Timer,
  top_objections: AlertCircle,
  best_message_style: MessageSquare,
  winning_sequences: Workflow,
  top_seller_by_stage: Trophy,
};

export function formatPatternEs(type: string, data: any): string {
  const d = data ?? {};
  switch (type) {
    case "best_followup_day":
      return `Tu mejor día para seguimientos: ${cap(d.day ?? "—")} (${pct(d.response_rate)} de tasa de respuesta).`;
    case "peak_response_hours":
      return `Horas pico de respuesta de tus clientes: ${(d.hours ?? []).map((h: number) => `${h}:00`).join(", ")}.`;
    case "avg_close_days":
      return `Tiempo promedio de cierre en tu empresa: ${d.days ?? "—"} días.`;
    case "top_objections":
      return `Tu objeción más frecuente: ${(d.objections ?? []).slice(0, 3).join(", ")}.`;
    case "best_message_style":
      return `Estilo de mensaje que mejor convierte: ${d.style ?? "—"}.`;
    case "winning_sequences":
      return `Secuencia ganadora: ${(d.steps ?? []).join(" → ")}.`;
    case "top_seller_by_stage":
      return `Tu vendedor estrella en ${d.stage ?? "—"}: ${d.seller ?? "—"} (${pct(d.rate)} avanza).`;
    default:
      return `${type}: ${JSON.stringify(d)}`;
  }
}

export function confidenceLabel(score: number): "Alta" | "Media" | "Baja" {
  if (score >= 0.8) return "Alta";
  if (score >= 0.5) return "Media";
  return "Baja";
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function pct(n?: number) { return `${Math.round((n ?? 0) * 100)}%`; }
