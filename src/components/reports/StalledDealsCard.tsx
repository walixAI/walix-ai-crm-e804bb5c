import { useMemo, useState } from "react";
import { PauseCircle, CircleSlash, MessageSquareOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import {
  useDiagnosticsDeals, useDealBlockers, useDealLossReasons, daysSince,
} from "@/lib/queries/dealDiagnostics";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

type View = "blockers" | "losses" | "cross";

export function StalledDealsCard() {
  const { data: deals = [], isLoading } = useDiagnosticsDeals();
  const { data: blockers = [] } = useDealBlockers();
  const { data: reasons = [] } = useDealLossReasons();
  const [view, setView] = useState<View>("blockers");

  const blockerName = (id: string | null) =>
    blockers.find((b) => b.id === id)?.label ?? "Sin bloqueo declarado";
  const reasonName = (id: string | null) =>
    reasons.find((r) => r.id === id)?.label ?? "Sin motivo registrado";

  const open = useMemo(() => deals.filter((d) => !d.isWon && !d.isLost), [deals]);
  const lost = useMemo(() => deals.filter((d) => d.isLost), [deals]);
  const silent = useMemo(() => open.filter((d) => d.noResponseSince), [open]);

  /** Distribución de bloqueos vigentes. */
  const blockerRows = useMemo(() => {
    const m = new Map<string, { count: number; amount: number; ageSum: number }>();
    for (const d of open) {
      const key = d.currentBlockerId ?? "none";
      const prev = m.get(key) ?? { count: 0, amount: 0, ageSum: 0 };
      m.set(key, {
        count: prev.count + 1,
        amount: prev.amount + d.amount,
        ageSum: prev.ageSum + (daysSince(d.blockerSetAt) ?? 0),
      });
    }
    return [...m.entries()]
      .map(([id, v]) => ({
        label: id === "none" ? "Sin bloqueo declarado" : blockerName(id),
        ...v,
        avgAge: v.count ? Math.round(v.ageSum / v.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [open, blockers]);

  /** Distribución de motivos de pérdida. */
  const lossRows = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>();
    for (const d of lost) {
      const key = d.lossReasonId ?? "none";
      const prev = m.get(key) ?? { count: 0, amount: 0 };
      m.set(key, { count: prev.count + 1, amount: prev.amount + d.amount });
    }
    return [...m.entries()]
      .map(([id, v]) => ({ label: id === "none" ? "Sin motivo registrado" : reasonName(id), ...v }))
      .sort((a, b) => b.count - a.count);
  }, [lost, reasons]);

  /** Matriz último bloqueo × motivo de pérdida. */
  const cross = useMemo(() => {
    const rowKeys = new Set<string>();
    const colKeys = new Set<string>();
    const cells = new Map<string, number>();
    for (const d of lost) {
      const r = d.lastKnownBlockerId ?? d.currentBlockerId ?? "none";
      const c = d.lossReasonId ?? "none";
      rowKeys.add(r);
      colKeys.add(c);
      const k = `${r}|${c}`;
      cells.set(k, (cells.get(k) ?? 0) + 1);
    }
    return {
      rows: [...rowKeys],
      cols: [...colKeys],
      get: (r: string, c: string) => cells.get(`${r}|${c}`) ?? 0,
    };
  }, [lost]);

  const maxCount = Math.max(1, ...blockerRows.map((r) => r.count));
  const maxLoss = Math.max(1, ...lossRows.map((r) => r.count));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Por qué no avanzan</h3>
          <p className="text-xs text-muted-foreground">
            Qué frena a los leads vivos, por qué se pierden y qué relación hay entre ambos.
          </p>
        </div>
        <div className="flex gap-1">
          {([
            { v: "blockers", label: "Bloqueos", icon: PauseCircle },
            { v: "losses", label: "Pérdidas", icon: CircleSlash },
            { v: "cross", label: "Cruce", icon: MessageSquareOff },
          ] as const).map((t) => (
            <Button
              key={t.v}
              size="sm"
              variant={view === t.v ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setView(t.v)}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <WBadge variant="info">{open.length} abiertas</WBadge>
        <WBadge variant="warning">
          {open.filter((d) => d.currentBlockerId).length} con bloqueo declarado
        </WBadge>
        <WBadge variant="danger">{silent.length} sin respuesta</WBadge>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Cargando…</p>
      ) : view === "blockers" ? (
        blockerRows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No hay oportunidades abiertas.</p>
        ) : (
          <div className="space-y-2">
            {blockerRows.map((r) => (
              <div key={r.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">
                    {r.count} · {money(r.amount)}
                    {r.avgAge > 0 && ` · ${r.avgAge} d prom.`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-warning"
                    style={{ width: `${(r.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      ) : view === "losses" ? (
        lossRows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No hay oportunidades perdidas registradas.</p>
        ) : (
          <div className="space-y-2">
            {lossRows.map((r) => (
              <div key={r.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">{r.count} · {money(r.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{ width: `${(r.count / maxLoss) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      ) : cross.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">
          Aún no hay suficientes pérdidas con diagnóstico para cruzar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 font-medium text-muted-foreground">
                  Último bloqueo → motivo final
                </th>
                {cross.cols.map((c) => (
                  <th key={c} className="text-center py-2 px-2 font-medium">
                    {c === "none" ? "Sin motivo" : reasonName(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cross.rows.map((r) => (
                <tr key={r} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">
                    {r === "none" ? "Sin bloqueo declarado" : blockerName(r)}
                  </td>
                  {cross.cols.map((c) => {
                    const n = cross.get(r, c);
                    return (
                      <td key={c} className="text-center py-2 px-2">
                        {n > 0 ? (
                          <span className="inline-flex min-w-6 justify-center rounded bg-danger/10 text-danger px-1.5 py-0.5 font-semibold">
                            {n}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}