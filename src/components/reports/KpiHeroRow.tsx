import { TrendingUp, TrendingDown, Wallet, Target, Percent, Clock } from "lucide-react";
import { kpiCards } from "@/mock/reports";
import { formatDelta, formatTimeDelta } from "@/lib/reports/format";
import { cn } from "@/lib/utils";

const ICONS = {
  revenue: Wallet,
  pipeline: Target,
  closeRate: Percent,
  cycle: Clock,
} as const;

export function KpiHeroRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpiCards.map(k => {
        const Icon = ICONS[k.id];
        const delta = k.id === "cycle" ? formatTimeDelta(k.delta) : formatDelta(k.delta);
        const TrendIcon = delta.tone === "positive" ? TrendingUp : TrendingDown;
        return (
          <div key={k.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5",
                delta.tone === "positive" ? "bg-success/10 text-success"
                : delta.tone === "negative" ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
              )}>
                <TrendIcon className="h-3 w-3" />
                {delta.label}
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
            <div className="text-[11px] text-muted-foreground/80 mt-1">{k.hint}</div>
          </div>
        );
      })}
    </div>
  );
}