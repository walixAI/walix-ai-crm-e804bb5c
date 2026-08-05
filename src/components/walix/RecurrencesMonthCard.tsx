import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useMonthlyServices,
  monthKey,
  SERVICE_STATUS_LABEL,
  type ServiceStatus,
} from "@/lib/queries/monthlyServices";

/**
 * Widget genérico de "Recurrencias del mes".
 * Lee el módulo de recurrencias (cualquier servicio periódico del tenant).
 * Si el tenant no tiene ocurrencias este mes, no se muestra.
 */
export function RecurrencesMonthCard() {
  const navigate = useNavigate();
  const month = monthKey(new Date());
  const { data: services = [], isLoading } = useMonthlyServices(month);

  const stats = useMemo(() => {
    const by: Partial<Record<ServiceStatus, number>> = {};
    for (const s of services) by[s.status] = (by[s.status] ?? 0) + 1;
    return {
      total: services.length,
      pending: (by.pending ?? 0) + (by.price_accepted ?? 0),
      scheduled: by.scheduled ?? 0,
      executed: by.executed ?? 0,
    };
  }, [services]);

  if (isLoading || stats.total === 0) return null;

  const pct = Math.round((stats.executed / stats.total) * 100);
  const monthLabel = new Date(month + "T00:00:00").toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  const cells: { label: string; value: number; tone: string }[] = [
    { label: SERVICE_STATUS_LABEL.pending, value: stats.pending, tone: "text-amber-600" },
    { label: SERVICE_STATUS_LABEL.scheduled, value: stats.scheduled, tone: "text-primary" },
    { label: SERVICE_STATUS_LABEL.executed, value: stats.executed, tone: "text-emerald-600" },
  ];

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Recurrencias del mes</h3>
            <p className="text-xs text-muted-foreground capitalize">{monthLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => navigate("/automations?tab=agenda")}
        >
          Agenda del mes <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg bg-muted/50 p-3">
            <p className={cn("text-2xl font-semibold tabular-nums", c.tone)}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Avance del mes</span>
          <span className="tabular-nums">{pct}% de {stats.total}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
