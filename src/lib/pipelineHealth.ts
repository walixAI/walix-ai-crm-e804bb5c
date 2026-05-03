export interface HealthInputs {
  activeDeals: number;
  staleActiveDeals: number;        // last_activity_at < hoy − 10d
  overdueActiveDeals: number;      // expected_close_date < hoy
  totalOpenConversations: number;
  unreadOpenConversations: number;
  weightedForecast: number;
  monthlyTarget: number;           // 0 si no hay
  wonLast30: number;
  lostLast30: number;
}

export type HealthStatus = "excellent" | "good" | "warning" | "critical";

export interface HealthComponent {
  key: "activity" | "responsiveness" | "coverage" | "winRate" | "velocity";
  label: string;
  /** 0..1 normalized score */
  value: number;
  weight: number;
  display: string;
  tone: "positive" | "neutral" | "negative";
}

export interface PipelineHealth {
  score: number;                   // 0..100
  status: HealthStatus;
  summary: string;
  components: HealthComponent[];
  topIssues: HealthComponent[];    // 3 con mayor impacto negativo
}

const WEIGHTS = {
  activity: 0.25,
  responsiveness: 0.25,
  coverage: 0.20,
  winRate: 0.15,
  velocity: 0.15,
} as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function statusFromScore(score: number): HealthStatus {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function toneFromValue(v: number): "positive" | "neutral" | "negative" {
  if (v >= 0.75) return "positive";
  if (v >= 0.5) return "neutral";
  return "negative";
}

export function computePipelineHealth(i: HealthInputs): PipelineHealth {
  const activity = i.activeDeals > 0 ? clamp01(1 - i.staleActiveDeals / i.activeDeals) : 1;
  const responsiveness = i.totalOpenConversations > 0
    ? clamp01(1 - i.unreadOpenConversations / i.totalOpenConversations)
    : 1;
  const coverage = i.monthlyTarget > 0
    ? clamp01(i.weightedForecast / i.monthlyTarget)
    : (i.weightedForecast > 0 ? 0.6 : 0.3);
  const winDenom = i.wonLast30 + i.lostLast30;
  const winRate = winDenom > 0 ? clamp01(i.wonLast30 / winDenom) : 0.5;
  const velocity = i.activeDeals > 0 ? clamp01(1 - i.overdueActiveDeals / i.activeDeals) : 1;

  const components: HealthComponent[] = [
    {
      key: "activity", label: "Actividad reciente", weight: WEIGHTS.activity,
      value: activity,
      display: i.activeDeals > 0
        ? `${i.activeDeals - i.staleActiveDeals}/${i.activeDeals} con actividad`
        : "—",
      tone: toneFromValue(activity),
    },
    {
      key: "responsiveness", label: "Respuesta a clientes", weight: WEIGHTS.responsiveness,
      value: responsiveness,
      display: i.totalOpenConversations > 0
        ? `${i.unreadOpenConversations} sin leer`
        : "Sin conversaciones",
      tone: toneFromValue(responsiveness),
    },
    {
      key: "coverage", label: "Cobertura del objetivo", weight: WEIGHTS.coverage,
      value: coverage,
      display: i.monthlyTarget > 0
        ? `${Math.round(coverage * 100)}% del objetivo`
        : "Sin objetivo definido",
      tone: toneFromValue(coverage),
    },
    {
      key: "winRate", label: "Tasa de cierre (30d)", weight: WEIGHTS.winRate,
      value: winRate,
      display: winDenom > 0 ? `${Math.round(winRate * 100)}%` : "Sin cierres",
      tone: toneFromValue(winRate),
    },
    {
      key: "velocity", label: "Oportunidades a tiempo", weight: WEIGHTS.velocity,
      value: velocity,
      display: i.activeDeals > 0
        ? `${i.overdueActiveDeals} vencidas`
        : "—",
      tone: toneFromValue(velocity),
    },
  ];

  const score = Math.round(
    100 * components.reduce((acc, c) => acc + c.value * c.weight, 0),
  );
  const status = statusFromScore(score);

  const topIssues = [...components]
    .map((c) => ({ c, impact: (1 - c.value) * c.weight }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map((x) => x.c);

  const summary = buildSummary(status, topIssues);

  return { score, status, summary, components, topIssues };
}

function buildSummary(status: HealthStatus, top: HealthComponent[]): string {
  const head =
    status === "excellent" ? "Pipeline en excelente estado."
    : status === "good"    ? "Pipeline saludable, con áreas a mejorar."
    : status === "warning" ? "Pipeline con focos de atención."
    :                        "Pipeline en estado crítico.";
  const issue = top.find((t) => t.tone === "negative");
  if (!issue) return head;
  const map: Record<HealthComponent["key"], string> = {
    activity: "muchas oportunidades sin actividad reciente",
    responsiveness: "conversaciones sin responder",
    coverage: "forecast por debajo del objetivo",
    winRate: "tasa de cierre baja",
    velocity: "oportunidades vencidas",
  };
  return `${head} Principal foco: ${map[issue.key]}.`;
}