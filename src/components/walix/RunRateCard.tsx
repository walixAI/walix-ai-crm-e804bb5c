import { useState } from "react";
import { TrendingUp, Target, Lightbulb, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useRunRate, formatMXN0 } from "@/lib/queries/runRate";
import { useRunRateBySeller } from "@/lib/queries/dashboardExtras";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  green:  { bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/30", label: "En camino" },
  yellow: { bg: "bg-amber-500/10",   text: "text-amber-600",   ring: "ring-amber-500/30",   label: "Atento" },
  red:    { bg: "bg-red-500/10",     text: "text-red-600",     ring: "ring-red-500/30",     label: "En riesgo" },
};

export function RunRateCard({ compact = false, showSellers = false }: { compact?: boolean; showSellers?: boolean }) {
  const { data, isLoading } = useRunRate();
  const [open, setOpen] = useState(false);
  const { data: sellers = [] } = useRunRateBySeller();
  if (isLoading || !data) return null;
  const c = STATUS_COLORS[data.status];

  if (data.monthGoal <= 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="p-5 flex items-center gap-4">
          <Target className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1">
            <div className="font-semibold">Define tu meta mensual</div>
            <div className="text-sm text-muted-foreground">Configura la meta para ver tu Run Rate del mes.</div>
          </div>
          <Button asChild size="sm"><Link to="/settings?tab=goals">Configurar</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-2", c.ring)}>
      <CardContent className={cn("p-5", compact ? "space-y-3" : "space-y-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("h-14 w-14 rounded-2xl grid place-items-center", c.bg)}>
              <TrendingUp className={cn("h-7 w-7", c.text)} />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Run Rate del mes</div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-4xl font-bold tracking-tight", c.text)}>
                  {Math.round(data.runRatePct)}%
                </span>
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", c.bg, c.text)}>{c.label}</span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Día {data.daysElapsed} de {data.daysTotal}
            <div className="text-[10px]">{data.countBusinessDays ? "hábiles" : "corridos"}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Progress value={Math.min(100, data.runRatePct)} className="h-2.5" />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Vendido" value={formatMXN0(data.sold)} tone={c.text} />
            <Stat label="Esperado hoy" value={formatMXN0(data.expectedToday)} />
            <Stat label="Meta mes" value={formatMXN0(data.monthGoal)} />
          </div>
          <div className="pt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Proyección de cierre</span>
            <span className={cn("font-bold", c.text)}>{formatMXN0(data.projection)}</span>
          </div>
        </div>

        {data.recommendations.length > 0 && !compact && (
          <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Recomendaciones
            </div>
            <ul className="space-y-1 text-sm">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{r}</span></li>
              ))}
            </ul>
          </div>
        )}

        {showSellers && (
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setOpen((o) => !o)}
              className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Detalle por vendedor ({sellers.length})
              </span>
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {open && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <span className="font-semibold">Global del mes</span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground">{formatMXN0(data.sold)} / {formatMXN0(data.monthGoal)}</span>
                    <span className={cn("font-bold", c.text)}>{Math.round(data.runRatePct)}%</span>
                  </span>
                </div>
                {sellers.length === 0 && (
                  <p className="text-xs text-muted-foreground italic px-1">Sin vendedores con meta asignada este mes.</p>
                )}
                {sellers.map((s) => {
                  const tone = s.runRatePct >= 100 ? "text-emerald-600" : s.runRatePct >= 70 ? "text-amber-600" : "text-red-600";
                  return (
                    <div key={s.userId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="text-muted-foreground">
                            {formatMXN0(s.won)}{s.assignedGoal > 0 ? ` / ${formatMXN0(s.assignedGoal)}` : ""}
                          </span>
                          <span className={cn("font-bold", tone)}>{Math.round(s.runRatePct)}%</span>
                        </span>
                      </div>
                      <Progress value={Math.min(100, s.runRatePct)} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-bold", tone)}>{value}</div>
    </div>
  );
}