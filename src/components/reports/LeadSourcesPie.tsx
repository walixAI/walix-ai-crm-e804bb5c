import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useReportsContext } from "@/lib/reports/context";
import { formatMXN, formatPct } from "@/lib/reports/format";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";

export function LeadSourcesPie() {
  const navigate = useNavigate();
  const { data, isLoading } = useReportsContext();

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="h-56" />
      </div>
    );
  }

  const sources = data.leadSources;
  const totalRevenue = sources.reduce((s, l) => s + l.revenue, 0);

  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-base mb-1">Fuentes de leads</h2>
        <p className="text-sm text-muted-foreground italic text-center py-8">Sin datos de fuentes en el período.</p>
      </div>
    );
  }

  const top = sources[0];
  const topPct = totalRevenue > 0 ? Math.round((top.revenue / totalRevenue) * 100) : 0;
  const insight = top.revenue > 0
    ? `${top.name} es tu fuente más rentable — genera el ${topPct}% de tu revenue.`
    : "Aún no hay revenue cerrado por fuente.";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-semibold text-base mb-1">Fuentes de leads</h2>
      <p className="text-xs text-muted-foreground mb-4">Distribución del revenue por canal de origen</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sources}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {sources.map(s => (<Cell key={s.id} fill={s.color} />))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, _name, item) => [formatMXN(v), (item as { payload: { name: string } }).payload.name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {sources.map(s => {
            const pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/contacts?source=${s.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
              >
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatPct(pct)}</span>
                <span className="text-sm font-semibold tabular-nums w-24 text-right">{formatMXN(s.revenue)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <InsightCard className="mt-4" text={insight} cta={{ label: `Ver contactos de ${top.name}`, onClick: () => navigate(`/contacts?source=${top.id}`) }} />
    </div>
  );
}
