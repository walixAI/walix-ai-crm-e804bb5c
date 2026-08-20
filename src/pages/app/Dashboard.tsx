import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useCopilot } from "@/store/copilot";
import {
  useDashboardKpis,
  usePipelineByStage, useDealsClosedTimeline,
} from "@/lib/queries/dashboard";
import {
  usePipelineBreakdown, useStaleDeals,
} from "@/lib/queries/dashboardExtras";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet, Target, MessageSquare, TrendingUp, ArrowUpRight, ArrowDownRight,
  Sparkles, AlertTriangle, X, SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { DashboardAiSection } from "@/components/walix/DashboardAiSection";
import { KpiCardsSkeleton } from "@/components/walix/Skeletons";
import { TaskCards } from "@/components/dashboard/TaskCards";
import { ActivityReportCard } from "@/components/dashboard/ActivityReportCard";
import { DealsListDialog } from "@/components/dashboard/DealsListDialog";
import { ChartFilters, rangeParams, type RangeValue } from "@/components/dashboard/ChartFilters";
import { MorningBriefing } from "@/components/walix/MorningBriefing";
import { RunRateCard } from "@/components/walix/RunRateCard";
import { ProfitabilityCard } from "@/components/walix/ProfitabilityCard";
import { RecurrencesMonthCard } from "@/components/walix/RecurrencesMonthCard";
import { LayoutRenderer, Widget } from "@/components/walix/widgets/LayoutRenderer";
import { CustomizeSheet } from "@/components/walix/widgets/CustomizeSheet";

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

const stageColors = [
  "hsl(239 84% 85%)",
  "hsl(239 84% 75%)",
  "hsl(239 84% 65%)",
  "hsl(239 84% 55%)",
  "hsl(239 84% 45%)",
  "hsl(239 84% 35%)",
];

export default function Dashboard() {
  const { user } = useAuth();
  const send = useCopilot((s) => s.send);
  const [showAlert, setShowAlert] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);
  const [stagePipeline, setStagePipeline] = useState("all");
  const [stageRange, setStageRange] = useState<RangeValue>({ preset: "90d" });
  const [closedPipeline, setClosedPipeline] = useState("all");
  const [closedRange, setClosedRange] = useState<RangeValue>({ preset: "30d" });

  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  // Legacy hardcoded suggestions replaced by ProactiveBriefing (uses ai_proactive_suggestions).
  const stageP = rangeParams(stageRange);
  const closedP = rangeParams(closedRange);
  const { data: pipelineByStage = [] } = usePipelineByStage(stagePipeline, stageP.days, stageP.from, stageP.to);
  const { data: dealsTimeline = [] } = useDealsClosedTimeline(closedP.days, closedPipeline, closedP.from, closedP.to);
  const { data: breakdown = [] } = usePipelineBreakdown();
  const { data: staleDeals = [] } = useStaleDeals(10);

  const atRiskDealsCount = staleDeals.length;
  const totalActive = breakdown.reduce((s, b) => s + b.activeCount, 0);
  const kpiData = [
    {
      label: "Valor del Pipeline", value: kpis ? formatMXN(kpis.pipelineValue) : "—", suffix: "MXN",
      delta: `+${kpis?.pipelineDeltaPct ?? 0}%`, trend: "up" as const, hint: "vs ayer", icon: Wallet,
      breakdown: breakdown.map((b) => ({ label: b.pipelineName, value: formatMXN(b.value) })),
    },
    {
      label: "Oportunidades Activas", value: String(totalActive || kpis?.activeDeals || 0), suffix: "abiertas",
      delta: String(atRiskDealsCount), trend: "down" as const, hint: "sin actividad", icon: Target,
      breakdown: breakdown.map((b) => ({ label: b.pipelineName, value: `${b.activeCount}` })),
    },
    { label: "Mensajes WhatsApp", value: String(kpis?.messagesToday ?? 0), suffix: "hoy", delta: String(kpis?.messagesUnanswered ?? 0), trend: "down" as const, hint: "sin respuesta", icon: MessageSquare, breakdown: [] },
    { label: "Tasa de Cierre", value: `${kpis?.closeRate ?? 0}%`, suffix: "", delta: `+${kpis?.closeRateDelta ?? 0}pts`, trend: "up" as const, hint: "este mes", icon: TrendingUp, breakdown: [] },
  ];

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const prettify = (v: string) =>
    v.replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const rawName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "ahí";
  // Never show an email address in the greeting.
  const displayName = rawName.includes("@") ? prettify(rawName.split("@")[0]) : rawName;
  const name = displayName.split(" ")[0];
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="space-y-6 max-w-[1400px]">
      <LayoutRenderer surface="dashboard">
        <Widget k="dash.morning_briefing">
          <MorningBriefing />
        </Widget>

        <Widget k="dash.risk_alert">
          {showAlert && atRiskDealsCount > 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div className="flex-1 text-foreground">
            <strong>{atRiskDealsCount} oportunidades</strong> llevan más de 10 días sin actividad.{" "}
            <button onClick={() => setStaleOpen(true)} className="font-medium text-warning underline-offset-2 hover:underline">
              Ver oportunidades →
            </button>
          </div>
          <button
            onClick={() => setShowAlert(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
            </div>
          ) : null}
        </Widget>

        <Widget k="dash.header">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {getGreeting()}, {name} 👋
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{today}</p>
        </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)} className="gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Personalizar
              </Button>
              <Button
                onClick={() => send("Dame el resumen del día: pipeline, leads calientes, oportunidades en riesgo y conversaciones pendientes.")}
                className="bg-gradient-brand hover:opacity-90 text-primary-foreground shadow-glow gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Resumen del día
              </Button>
            </div>
          </div>
        </Widget>

        <Widget k="dash.run_rate">
          <RunRateCard compact showSellers />
        </Widget>

        <Widget k="dash.profitability">
          <ProfitabilityCard />
        </Widget>

        <Widget k="dash.recurrences_month">
          <RecurrencesMonthCard />
        </Widget>

        <Widget k="dash.kpi_cards">
          {kpisLoading && !kpis ? (
            <KpiCardsSkeleton />
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((k) => {
          const Icon = k.icon;
          const TrendIcon = k.trend === "up" ? ArrowUpRight : ArrowDownRight;
          return (
            <div
              key={k.label}
              className="rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium text-muted-foreground">{k.label}</div>
                <div className="h-9 w-9 grid place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight">{k.value}</span>
                {k.suffix && <span className="text-xs text-muted-foreground">{k.suffix}</span>}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                <span className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  k.trend === "up" ? "text-success" : "text-danger"
                )}>
                  <TrendIcon className="h-3 w-3" />
                  {k.delta}
                </span>
                <span className="text-muted-foreground">{k.hint}</span>
              </div>
              {k.breakdown.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border space-y-1">
                  {k.breakdown.map((b) => (
                    <div key={b.label} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground truncate">{b.label}</span>
                      <span className="font-semibold">{b.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
          </div>
          )}
        </Widget>

        <Widget k="dash.ai_section">
          <DashboardAiSection />
        </Widget>

        <Widget k="dash.task_cards">
          <TaskCards />
        </Widget>

        <Widget k="dash.activity">
          <ActivityReportCard />
        </Widget>

        <Widget k="dash.pipeline_chart">
        {/* Pipeline by stage */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Pipeline por Etapa</h3>
              <p className="text-xs text-muted-foreground">Valor MXN acumulado</p>
            </div>
            <ChartFilters
              pipelineId={stagePipeline} onPipeline={setStagePipeline}
              range={stageRange} onRange={setStageRange}
            />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineByStage} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="stage"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatMXN(v), "Valor"]}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {pipelineByStage.map((_, i) => (
                    <Cell key={i} fill={stageColors[i % stageColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </Widget>

        <Widget k="dash.deals_closed">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Oportunidades cerradas</h3>
              <p className="text-xs text-muted-foreground">Ganadas en el periodo seleccionado</p>
            </div>
            <ChartFilters
              pipelineId={closedPipeline} onPipeline={setClosedPipeline}
              range={closedRange} onRange={setClosedRange}
            />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dealsTimeline} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatMXN(v), "Cerrado"]}
                  labelFormatter={(l) => `Día ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2.5}
                  fill="url(#gClosed)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        </Widget>
      </LayoutRenderer>

      <DealsListDialog
        open={staleOpen}
        onOpenChange={setStaleOpen}
        title="Oportunidades sin actividad"
        description="Más de 10 días sin movimiento"
        deals={staleDeals.map((d) => ({
          id: d.id, name: d.name, amount: d.amount,
          stageName: d.stageName, ownerName: d.ownerName,
          contactId: d.contactId,
          extra: `Última actividad ${new Date(d.updatedAt).toLocaleDateString("es-MX")}`,
        }))}
      />

      <CustomizeSheet open={customizeOpen} onOpenChange={setCustomizeOpen} surface="dashboard" scope="user" />
    </div>
  );
}
