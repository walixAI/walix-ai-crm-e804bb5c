import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { lostReasons, lostTotalAmount, lostInsight } from "@/mock/reports";
import { formatMXN } from "@/lib/reports/format";
import { InsightCard } from "./InsightCard";

const BAR_COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--accent))", "hsl(var(--muted-foreground))"];

export function LostDealsChart() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-end justify-between mb-4 gap-2">
        <div>
          <h2 className="font-semibold text-base">Razones de pérdida</h2>
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive font-semibold">{formatMXN(lostTotalAmount)}</span> perdidos este período
          </p>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={lostReasons.map(r => ({ name: r.reason, count: r.count, amount: r.amount }))}
            layout="vertical"
            margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
          >
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={170} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(_v, _n, item) => {
                const p = (item as { payload: { count: number; amount: number } }).payload;
                return [`${p.count} deals · ${formatMXN(p.amount)}`, "Pérdida"];
              }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {lostReasons.map((_, i) => (<Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <InsightCard
        className="mt-4"
        tone="warning"
        text={lostInsight}
        cta={{ label: "Ver argumentos del top vendedor", onClick: () => navigate("/whatsapp") }}
      />
    </div>
  );
}