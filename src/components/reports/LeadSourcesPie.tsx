import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { leadSources, sourceInsight } from "@/mock/reports";
import { formatMXN, formatPct } from "@/lib/reports/format";
import { InsightCard } from "./InsightCard";

export function LeadSourcesPie() {
  const navigate = useNavigate();
  const totalRevenue = leadSources.reduce((s, l) => s + l.revenue, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-semibold text-base mb-1">Fuentes de leads</h2>
      <p className="text-xs text-muted-foreground mb-4">Distribución del revenue por canal de origen</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={leadSources}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {leadSources.map(s => (<Cell key={s.id} fill={s.color} />))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, _name, item) => [formatMXN(v), (item as { payload: { name: string } }).payload.name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {leadSources.map(s => {
            const pct = (s.revenue / totalRevenue) * 100;
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

      <InsightCard className="mt-4" text={sourceInsight} cta={{ label: "Ver contactos de WhatsApp", onClick: () => navigate("/contacts?source=whatsapp") }} />
    </div>
  );
}