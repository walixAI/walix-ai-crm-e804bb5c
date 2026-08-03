import { PauseCircle, MessageSquareOff, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useDealBlockers, useDealLossReasons, daysSince } from "@/lib/queries/dealDiagnostics";
import type { PipelineDeal } from "@/lib/queries/pipeline";

/** Muestra por qué la oportunidad no avanza: bloqueo vigente, silencio y motivo de pérdida. */
export function DealDiagnosticPanel({ deal }: { deal: PipelineDeal }) {
  const { data: blockers = [] } = useDealBlockers();
  const { data: reasons = [] } = useDealLossReasons();

  const blocker = blockers.find((b) => b.id === deal.currentBlockerId) ?? null;
  const lastKnown = blockers.find((b) => b.id === deal.lastKnownBlockerId) ?? null;
  const age = daysSince(deal.blockerSetAt);
  const silentDays = daysSince(deal.noResponseSince);

  if (!blocker && !deal.noResponseSince && !lastKnown) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        Por qué no avanza
      </div>

      {blocker && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <PauseCircle className="h-4 w-4" />
            {blocker.label}
            {age !== null && <span className="text-xs font-normal opacity-80">· hace {age} d</span>}
          </div>
          {deal.blockerExpectedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Debería resolverse el{" "}
              {format(new Date(`${deal.blockerExpectedAt}T12:00:00`), "PPP", { locale: es })}
            </div>
          )}
        </div>
      )}

      {deal.noResponseSince && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-danger">
            <MessageSquareOff className="h-4 w-4" />
            Sin respuesta del cliente
            {silentDays !== null && (
              <span className="text-xs font-normal opacity-80">· {silentDays} d</span>
            )}
          </div>
          {lastKnown && (
            <p className="text-xs text-muted-foreground">
              Última señal conocida: <strong>{lastKnown.label}</strong>
            </p>
          )}
        </div>
      )}

      {!blocker && !deal.noResponseSince && lastKnown && (
        <p className="text-xs text-muted-foreground">
          Último bloqueo declarado: <strong>{lastKnown.label}</strong>
          {deal.isLost && reasons.length > 0 && " (oportunidad cerrada)"}
        </p>
      )}
    </div>
  );
}