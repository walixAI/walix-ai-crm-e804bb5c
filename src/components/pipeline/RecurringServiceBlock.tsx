import { RefreshCw, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import {
  useDealRecurrence, useCloseRecurrence, monthLabel, formatServiceMonths,
} from "@/lib/queries/recurrence";

const periodLabel = (m: number) =>
  m === 3 ? "Trimestral" : m === 6 ? "Semestral" : m === 12 ? "Anual" : `Cada ${m} meses`;

const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  notified: "Avisado",
  scheduled: "Agendado",
  executed: "Ejecutado",
  completed: "Ejecutado",
  skipped: "No procede",
  postponed: "Reprogramado",
};

export function RecurringServiceBlock({ dealId, isWon }: { dealId: string; isWon: boolean }) {
  const { data: rec } = useDealRecurrence(dealId);
  const close = useCloseRecurrence();

  if (!rec) return null;

  const alreadyClosed = rec.status === "executed" || rec.status === "completed";

  async function scheduleNext() {
    try {
      const r = await close.mutateAsync(dealId);
      if (r?.ok) {
        const dates: string[] = (r.next_dates ?? []).slice(0, 2);
        toast.success(
          dates.length
            ? `Siguientes servicios: ${formatServiceMonths(dates)}`
            : "Ciclo actualizado",
        );
      } else {
        toast.info("Marca la oportunidad como Ganada para programar el siguiente servicio.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo programar el siguiente servicio");
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className="h-4 w-4 text-primary" />
          Servicio recurrente
        </div>
        <WBadge variant={alreadyClosed ? "success" : "info"}>
          {statusLabel[rec.status] ?? rec.status}
        </WBadge>
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          <span className="text-foreground">{rec.serviceName}</span> · {periodLabel(rec.periodMonths)}
        </p>
        <p>Corresponde a {monthLabel(rec.dueDate)}</p>
        <p className="flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          {rec.nextDates.length
            ? `Próximos: ${formatServiceMonths(rec.nextDates.slice(0, 2))}`
            : "Sin próximos servicios programados"}
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={close.isPending || (!isWon && !alreadyClosed)}
        onClick={scheduleNext}
      >
        {close.isPending ? "Programando…" : "Programar siguiente servicio"}
      </Button>
      {!isWon && !alreadyClosed && (
        <p className="text-[11px] text-muted-foreground">
          Al marcar la oportunidad como Ganada, Walix programa las siguientes citas automáticamente.
        </p>
      )}
    </div>
  );
}