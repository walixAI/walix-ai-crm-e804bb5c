import { useNavigate } from "react-router-dom";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { stageConversions, conversionInsight } from "@/mock/reports";
import { formatPct } from "@/lib/reports/format";
import { cn } from "@/lib/utils";
import { InsightCard } from "./InsightCard";

export function StageConversionsSection() {
  const navigate = useNavigate();
  const max = Math.max(...stageConversions.map(c => c.advanced));

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-semibold text-base mb-1">Conversiones por etapa</h2>
      <p className="text-xs text-muted-foreground mb-4">Identifica los puntos donde se cae más gente del embudo</p>

      <div className="space-y-2 mb-4">
        {stageConversions.map((c, i) => {
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

      <InsightCard
        text={conversionInsight}
        cta={{ label: "Ver deals atorados en Propuesta", onClick: () => navigate("/pipeline?stage=proposal") }}
      />
    </div>
  );
}