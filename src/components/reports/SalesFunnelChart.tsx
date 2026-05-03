import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useReportsContext } from "@/lib/reports/context";
import { formatMXN, formatPct } from "@/lib/reports/format";
import { Skeleton } from "@/components/ui/skeleton";

export function SalesFunnelChart() {
  const navigate = useNavigate();
  const { data, isLoading } = useReportsContext();

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      </div>
    );
  }

  const stages = data.funnel;

  if (stages.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card text-center text-sm text-muted-foreground">
        Sin etapas configuradas en el pipeline.
      </div>
    );
  }

  const max = Math.max(1, ...stages.map(s => s.count));
  const stageWidthPct = (count: number) => Math.max((count / max) * 100, 8);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-base">Embudo de ventas</h2>
          <p className="text-xs text-muted-foreground">Conversión por etapa · click para ver detalle</p>
        </div>
      </div>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const width = stageWidthPct(s.count);
          const intensity = 0.25 + (i / Math.max(1, stages.length - 1)) * 0.6;
          return (
            <Popover key={s.id}>
              <PopoverTrigger asChild>
                <button
                  className="w-full group relative flex items-center"
                  style={{ height: 44 }}
                  aria-label={`${s.name}: ${s.count} deals`}
                >
                  <div className="absolute inset-y-0 right-0 flex items-center justify-end" style={{ width: `${width}%` }}>
                    <div
                      className="h-full w-full rounded-md transition-all group-hover:ring-2 group-hover:ring-primary/40"
                      style={{
                        background: `linear-gradient(90deg, hsl(var(--primary) / ${intensity * 0.7}), hsl(var(--primary) / ${intensity}))`,
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
                    <span className="text-xs font-semibold text-foreground">{s.name}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums">
                      {s.count} · {formatMXN(s.value)}
                      {s.conversionFromPrev != null && (
                        <span className="ml-2 text-muted-foreground font-normal">
                          ({formatPct(s.conversionFromPrev)})
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-2">
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Oportunidades</div>
                      <div className="font-bold">{s.count}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Valor</div>
                      <div className="font-bold">{formatMXN(s.value)}</div>
                    </div>
                    {s.conversionFromPrev != null && (
                      <div className="col-span-2">
                        <div className="text-muted-foreground">Conversión desde anterior</div>
                        <div className="font-bold">{formatPct(s.conversionFromPrev)}</div>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => navigate(`/pipeline?stage=${s.id}`)}
                  >
                    Ver deals de esta etapa <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
