import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, TrendingUp, AlertTriangle, Target, Calendar,
  ArrowRight, Loader2, RefreshCw, Activity, ShieldAlert, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchDashboardAiWidgets, AI_MODEL_LABEL,
  type DashboardAiResponse, type RiskWidget,
} from "@/services/ai";
import { AiSectionSkeleton } from "@/components/walix/Skeletons";
import { renderCitations, formatMXN } from "@/lib/ai/citations";
import { usePipelineHealthScore } from "@/lib/queries/dashboard";
import { useClosingSoon, useStaleDeals, useOverdueDeals } from "@/lib/queries/dashboardExtras";
import { DealsListDialog, type DealListItem } from "@/components/dashboard/DealsListDialog";
import type { HealthStatus } from "@/lib/pipelineHealth";

const REPORT_CACHE_KEY = "walix.weeklyReport.v1";

interface CachedReport {
  week: string;
  data: DashboardAiResponse;
}

function healthColor(status: HealthStatus) {
  switch (status) {
    case "excellent": return { bg: "bg-success/10", text: "text-success", border: "border-success/30", ring: "stroke-success" };
    case "good":      return { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", ring: "stroke-primary" };
    case "warning":   return { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30", ring: "stroke-warning" };
    case "critical":  return { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", ring: "stroke-destructive" };
  }
}

function severityStyle(s: RiskWidget["severity"]) {
  return s === "high"   ? "bg-destructive/10 text-destructive border-destructive/30"
       : s === "medium" ? "bg-warning/10 text-warning border-warning/30"
       :                  "bg-muted text-muted-foreground border-border";
}

export function DashboardAiSection() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardAiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const { data: health } = usePipelineHealthScore();
  const { data: closingSoon = [] } = useClosingSoon();
  const { data: staleDeals = [] } = useStaleDeals(10);
  const { data: overdueDeals = [] } = useOverdueDeals();
  const [listDialog, setListDialog] = useState<{ title: string; description?: string; deals: DealListItem[] } | null>(null);

  const handleCitation = (kind: string, id: string) => {
    if (kind === "deal" || kind === "oportunidad") navigate(`/pipeline?dealId=${id}`);
    else if (kind === "contact") navigate(`/contacts/${id}`);
    else if (kind === "convo" || kind === "conversation") navigate(`/whatsapp?conversationId=${id}`);
  };

  const openEntity = (type: RiskWidget["entityType"], id?: string) => {
    if (type === "deal") navigate(id ? `/pipeline?dealId=${id}` : "/pipeline");
    else if (type === "conversation") navigate(id ? `/whatsapp?conversationId=${id}` : "/whatsapp");
    else if (type === "contact") navigate(id ? `/contacts/${id}` : "/contacts");
    else navigate("/pipeline");
  };

  const openRisk = (r: RiskWidget) => {
    if (r.entityId) { openEntity(r.entityType, r.entityId); return; }
    const text = `${r.title} ${r.detail}`.toLowerCase();
    if (r.entityType === "conversation") { navigate("/whatsapp"); return; }
    const useOverdue = /vencid|fecha|cierre|atrasad/.test(text);
    const source = useOverdue ? overdueDeals : staleDeals;
    setListDialog({
      title: r.title,
      description: r.detail,
      deals: source.map((d) => ({
        id: d.id, name: d.name, amount: d.amount,
        stageName: d.stageName, ownerName: d.ownerName,
        extra: useOverdue && d.expectedCloseDate ? `Cierre ${d.expectedCloseDate}` : undefined,
      })),
    });
  };

  const load = async (forceRefreshReport = false) => {
    setLoading(true);
    // Try cached weekly report first
    let cachedReport: CachedReport | null = null;
    if (!forceRefreshReport) {
      try {
        const raw = localStorage.getItem(REPORT_CACHE_KEY);
        if (raw) cachedReport = JSON.parse(raw) as CachedReport;
      } catch { /* ignore */ }
    }
    // We always fetch widgets; only fetch full report if cache is missing/stale
    const needReport = forceRefreshReport || !cachedReport;
    const res = await fetchDashboardAiWidgets(needReport);
    if (cachedReport && cachedReport.week === res.week && !needReport) {
      res.weeklyReport = cachedReport.data.weeklyReport;
    }
    if (res.weeklyReport && res.source === "live") {
      try {
        localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify({ week: res.week, data: res } satisfies CachedReport));
      } catch { /* ignore */ }
    }
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(false); /* eslint-disable-next-line */ }, []);

  if (loading && !data) {
    return <AiSectionSkeleton />;
  }
  if (!data) return null;

  const status: HealthStatus = health?.status ?? data.pipelineHealth.status;
  const score = health?.score ?? data.pipelineHealth.score;
  const summary = health?.summary ?? data.pipelineHealth.summary;
  const signals = health
    ? health.components.map((c) => ({ label: c.label, value: c.display, tone: c.tone }))
    : data.pipelineHealth.signals;
  const hc = healthColor(status);
  const circumference = 2 * Math.PI * 32;
  const dash = (score / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 grid place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-glow">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Inteligencia IA</h2>
            <p className="text-[11px] text-muted-foreground">
              Generado {new Date(data.generatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {AI_MODEL_LABEL}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Regenerar
        </Button>
      </div>

      {/* Row 1: 3 widgets — Pipeline Health, Opportunities, Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline Health */}
        <div className={cn("rounded-xl border p-5 shadow-card", hc.border, hc.bg)}>
          <div className="flex items-center gap-2 mb-3">
            <Activity className={cn("h-4 w-4", hc.text)} />
            <h3 className="font-semibold text-sm">Salud del Pipeline</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                <circle cx="40" cy="40" r="32" fill="none" strokeWidth="6" strokeLinecap="round"
                  className={hc.ring} strokeDasharray={`${dash} ${circumference}`} />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className={cn("text-xl font-bold", hc.text)}>{score}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug">{summary}</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {signals.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.label}</span>
                <span className={cn(
                  "font-semibold",
                  s.tone === "positive" ? "text-success"
                  : s.tone === "negative" ? "text-destructive"
                  : "text-foreground"
                )}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Opportunities — real data: deals in the stage right before "Ganado" */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-sm">Próximas a cerrar</h3>
            </div>
            {closingSoon.length > 0 && (
              <button
                onClick={() => setListDialog({
                  title: "Próximas a cerrar",
                  description: "Etapa previa a Ganado en todos los pipelines",
                  deals: closingSoon.map((d) => ({
                    id: d.id, name: d.name, amount: d.amount,
                    stageName: `${d.pipelineName} · ${d.stageName}`, ownerName: d.ownerName,
                    extra: d.expectedCloseDate ? `Cierre ${d.expectedCloseDate}` : undefined,
                  })),
                })}
                className="text-[11px] text-primary hover:underline"
              >
                Ver todas ({closingSoon.length})
              </button>
            )}
          </div>
          {closingSoon.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-4 text-center">
              Sin oportunidades en la etapa previa a Ganado.
            </div>
          ) : (
            <div className="space-y-2">
              {closingSoon.slice(0, 3).map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate(`/pipeline?dealId=${o.id}`)}
                  className="w-full text-left group rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 p-2.5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground truncate flex-1">{o.name}</span>
                    <span className="text-[11px] font-bold text-primary shrink-0">{formatMXN(o.amount)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {o.pipelineName} · {o.stageName} · {o.ownerName}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-accent font-medium truncate">
                      {o.expectedCloseDate ? `Cierre estimado ${o.expectedCloseDate}` : "Sin fecha de cierre"}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Risks */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <h3 className="font-semibold text-sm">Riesgos esta semana</h3>
          </div>
          {data.risks.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-4 text-center">
              Sin riesgos detectados. ✨
            </div>
          ) : (
            <div className="space-y-2">
              {data.risks.slice(0, 4).map((r, i) => (
                <button
                  key={i}
                  onClick={() => openRisk(r)}
                  className="w-full text-left group rounded-lg border border-border hover:border-warning/40 hover:bg-warning/5 p-2.5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground truncate flex-1">{r.title}</span>
                    <span className={cn("text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0", severityStyle(r.severity))}>
                      {r.severity === "high" ? "Alta" : r.severity === "medium" ? "Media" : "Baja"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{r.detail}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Executive summary (full-width) */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Resumen ejecutivo del día</h3>
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {renderCitations(data.executiveSummary, handleCitation)}
        </p>
      </div>

      {/* Row 3: Weekly report (collapsible) */}
      {data.weeklyReport && (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <button
            onClick={() => setReportOpen(o => !o)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-left">
              <Calendar className="h-4 w-4 text-primary" />
              <div>
                <h3 className="font-semibold text-sm">Reporte semanal · {data.week}</h3>
                <p className="text-xs text-muted-foreground">{data.weeklyReport.headline}</p>
              </div>
            </div>
            {reportOpen
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {reportOpen && (
            <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border">
              <ReportColumn
                title="Logros"
                items={data.weeklyReport.highlights}
                accent="text-success"
                Icon={TrendingUp}
              />
              <ReportColumn
                title="A vigilar"
                items={data.weeklyReport.concerns}
                accent="text-warning"
                Icon={AlertTriangle}
              />
              <ReportColumn
                title="Foco próxima semana"
                items={data.weeklyReport.nextWeekFocus}
                accent="text-primary"
                Icon={Target}
              />
            </div>
          )}
        </div>
      )}

      {data.source === "fallback" && (
        <div className="text-[11px] text-muted-foreground italic">
          Mostrando datos de demostración: el servicio IA no respondió.
        </div>
      )}

      <DealsListDialog
        open={!!listDialog}
        onOpenChange={(v) => !v && setListDialog(null)}
        title={listDialog?.title ?? ""}
        description={listDialog?.description}
        deals={listDialog?.deals ?? []}
      />
    </div>
  );
}

function ReportColumn({ title, items, accent, Icon }: {
  title: string; items: string[]; accent: string;
  Icon: typeof TrendingUp;
}) {
  return (
    <div>
      <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 mt-4", accent)}>
        <Icon className="h-3 w-3" /> {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-xs text-foreground flex gap-1.5">
              <span className={cn("shrink-0", accent)}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}