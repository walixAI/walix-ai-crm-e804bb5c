import { ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AdvisorCallRow } from "@/lib/reports/callsReport";

type SortKey = "outboundTotal" | "outboundEffective" | "outboundRate" | "inboundReceived" | "inboundMissed";

const COLUMNS: { key: SortKey; label: string; hint: string }[] = [
  { key: "outboundTotal", label: "Salientes", hint: "Llamadas marcadas desde Walix" },
  { key: "outboundEffective", label: "Efectivas", hint: "Contestaron y hubo conversación" },
  { key: "outboundRate", label: "Tasa %", hint: "Efectivas sobre las marcadas" },
  { key: "inboundReceived", label: "Entrantes", hint: "Llamadas que llegaron al número" },
  { key: "inboundMissed", label: "No atendidas", hint: "Entrantes que nadie contestó" },
];

function sortRows(rows: AdvisorCallRow[], key: SortKey, dir: "asc" | "desc"): AdvisorCallRow[] {
  return [...rows].sort((a, b) => (dir === "desc" ? b[key] - a[key] : a[key] - b[key]));
}

interface Props {
  rows: AdvisorCallRow[];
  isLoading: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}

/** Llamadas de cada responsable en el periodo: salientes, efectivas y entrantes no atendidas. */
export function CallsByAdvisorTable({ rows, isLoading, sortKey, sortDir, onSort }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="mb-3 h-5 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        No hay llamadas con responsable en este periodo.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-5 pb-2 pt-4">
        <h2 className="text-base font-semibold">Llamadas por responsable</h2>
        <p className="text-xs text-muted-foreground">Ordena por cualquier columna · las llamadas sin asesor aparecen como grupo de recepción</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Responsable</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-semibold" title={c.hint}>
                  <button className="inline-flex items-center gap-1 hover:text-primary" onClick={() => onSort(c.key)}>
                    {c.label} <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {sortRows(rows, sortKey, sortDir).map((a) => (
              <tr key={a.key} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3">
                  <span className={cn("font-medium", !a.advisorId && "text-muted-foreground")}>{a.advisorName}</span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{a.outboundTotal}</td>
                <td className="px-3 py-3 text-right tabular-nums">{a.outboundEffective}</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">{a.outboundRate}%</td>
                <td className="px-3 py-3 text-right tabular-nums">{a.inboundReceived}</td>
                <td className={cn("px-3 py-3 text-right tabular-nums", a.inboundMissed > 0 && "font-semibold text-destructive")}>
                  {a.inboundMissed}
                </td>
                <td className="px-3 py-3 text-right text-xs tabular-nums text-muted-foreground">
                  {a.lastActivity ? new Date(a.lastActivity).toLocaleString("es-MX") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
