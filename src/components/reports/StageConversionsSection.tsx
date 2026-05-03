import { useNavigate } from "react-router-dom";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { useReportsContext } from "@/lib/reports/context";
import { formatPct } from "@/lib/reports/format";
import { cn } from "@/lib/utils";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";

export function StageConversionsSection() {
  const navigate = useNavigate();
  const { data, isLoading } = useReportsContext();

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="h-48" />
      </div>
    );
  }

  const conversions = data.stageConversions;

  if (conversions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-base mb-1">Conversiones por etapa</h2>
        <p className="text-sm text-muted-foreground italic text-center py-8">Sin movimientos entre etapas en el período.</p>
      </div>
    );
  }

  const max = Math.max(1, ...conversions.map(c => c.advanced));
  const weakest = [...conversions].sort((a, b) => a.rate - b.rate)[0];
  const insight = weakest
    ? `Solo el ${weakest.rate}% pasa de ${weakest.from} a ${weakest.to} — esta es tu mayor deal.`
    : "";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-semibold text-base mb-1">Conversiones por etapa</h2>
      <p className="text-xs text-muted-foreground mb-4">Identifica los puntos donde se cae más gente del embudo</p>

      <div className="space-y-2 mb-4">
        {conversions.map((c, i) => {
          const lowConversion = c.rate < 30;
          const widthPct = (c.advanced / max) * 100;
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                lowConversion ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium min-w-0 flex-1">
                  <span className="truncate">{c.from}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{c.to}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">{c.advanced} deals</span>
                  <span className={cn(
                    "text-sm font-bold tabular-nums w-12 text-right",
                    lowConversion && "text-destructive",
                  )}>
                    {formatPct(c.rate)}
                  </span>
                  {lowConversion && <AlertTriangle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", lowConversion ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {insight && (
        <InsightCard
          text={insight}
          cta={{ label: "Ver pipeline", onClick: () => navigate("/pipeline") }}
        />
      )}
    </div>
  );
}
