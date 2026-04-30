import { useMemo, useState } from "react";
import { ArrowUpDown, Trophy, ArrowRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportsContext } from "@/lib/reports/context";
import { formatMXN, formatPct } from "@/lib/reports/format";
import { cn } from "@/lib/utils";
import { SellerDetailDrawer } from "./SellerDetailDrawer";
import type { SellerPerformanceRow } from "@/lib/queries/reports";

type SortKey = keyof SellerPerformanceRow;

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "leadsAssigned",    label: "Leads",       align: "right" },
  { key: "activeDeals",      label: "Activos",     align: "right" },
  { key: "closedDeals",      label: "Cerrados",    align: "right" },
  { key: "revenueGenerated", label: "Revenue",     align: "right" },
  { key: "avgCloseDays",     label: "Días cierre", align: "right" },
  { key: "closeRate",        label: "Tasa %",      align: "right" },
];

export function SellerPerformanceTable() {
  const { data, isLoading, users } = useReportsContext();
  const [sortKey, setSortKey] = useState<SortKey>("revenueGenerated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openSeller, setOpenSeller] = useState<string | null>(null);

  const rows = data?.sellerPerformance ?? [];

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [rows, sortKey, sortDir]);

  const topId = useMemo(
    () => [...rows].sort((a, b) => b.revenueGenerated - a.revenueGenerated)[0]?.sellerId,
    [rows],
  );

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const sellerName = (id: string) => users.find(s => s.id === id);

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card text-center text-sm text-muted-foreground">
        Aún no hay vendedores con actividad en este período.
      </div>
    );
  }

  const chartData = rows.map(p => ({
    name: (sellerName(p.sellerId)?.name ?? "—").split(" ")[0],
    revenue: p.revenueGenerated,
  }));

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="p-5 pb-3">
        <h2 className="font-semibold text-base">Rendimiento por vendedor</h2>
        <p className="text-xs text-muted-foreground">Ordena por cualquier columna · click "Detalle" para sus deals</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Vendedor</th>
              {COLUMNS.map(c => (
                <th key={c.key} className={cn("px-3 py-2 font-semibold", c.align === "right" ? "text-right" : "text-left")}>
                  <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-primary">
                    {c.label} <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const s = sellerName(p.sellerId);
              const isTop = p.sellerId === topId;
              return (
                <tr key={p.sellerId} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center text-[11px] font-bold">
                        {s?.initials ?? "—"}
                      </span>
                      <span className="font-medium">{s?.name ?? "Sin nombre"}</span>
                      {isTop && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">
                          <Trophy className="h-3 w-3" /> Top
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.leadsAssigned}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.activeDeals}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.closedDeals}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{formatMXN(p.revenueGenerated)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.avgCloseDays}d</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatPct(p.closeRate)}</td>
                  <td className="px-3 py-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpenSeller(p.sellerId)}>
                      Detalle <ArrowRight className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-5 pt-3 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground mb-2">Revenue por vendedor</div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={70} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [formatMXN(v), "Revenue"]}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SellerDetailDrawer sellerId={openSeller} open={openSeller !== null} onClose={() => setOpenSeller(null)} />
    </div>
  );
}
