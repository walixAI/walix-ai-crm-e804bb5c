import { memo } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  hint?: string;
  icon?: LucideIcon;
  accent?: boolean;
}

function KpiCardImpl({ label, value, delta, trend = "up", hint, icon: Icon, accent }: Props) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-5 shadow-card hover:shadow-card-hover transition-all duration-200",
      accent && "bg-gradient-brand text-primary-foreground border-transparent shadow-glow"
    )}>
      <div className="flex items-start justify-between">
        <div className={cn("text-sm font-medium", accent ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {label}
        </div>
        {Icon && (
          <div className={cn(
            "h-8 w-8 grid place-items-center rounded-lg",
            accent ? "bg-white/15" : "bg-primary/10 text-primary"
          )}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta && (
          <span className={cn(
            "inline-flex items-center gap-0.5 font-medium",
            accent ? "text-primary-foreground" : trend === "up" ? "text-success" : "text-danger"
          )}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </span>
        )}
        {hint && <span className={cn(accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{hint}</span>}
      </div>
    </div>
  );
}

export const KpiCard = memo(KpiCardImpl);