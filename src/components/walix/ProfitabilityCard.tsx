import { PiggyBank } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMonthProfitability, formatMXN0 } from "@/lib/queries/expenses";
import { Link } from "react-router-dom";

const TONE = {
  green:  { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Saludable" },
  yellow: { bg: "bg-amber-500/10",   text: "text-amber-600",   label: "En vigilancia" },
  orange: { bg: "bg-orange-500/10",  text: "text-orange-600",  label: "Al límite" },
  red:    { bg: "bg-red-500/10",     text: "text-red-600",     label: "En pérdida" },
} as const;

export function ProfitabilityCard({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useMonthProfitability();
  if (isLoading || !data) return null;
  const t = TONE[data.status];

  return (
    <Card className="border-2">
      <CardContent className={cn("p-5 flex items-center gap-4", compact && "p-4")}>
        <div className={cn("h-14 w-14 rounded-2xl grid place-items-center shrink-0", t.bg)}>
          <PiggyBank className={cn("h-7 w-7", t.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-muted-foreground">Rentabilidad del mes</div>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold tracking-tight", t.text)}>
              {data.sales > 0 ? `${data.pct.toFixed(1)}%` : "—"}
            </span>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", t.bg, t.text)}>{t.label}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Ventas <span className="font-semibold text-foreground">{formatMXN0(data.sales)}</span> · Gastos <span className="font-semibold text-foreground">{formatMXN0(data.expenses)}</span> · Utilidad <span className={cn("font-semibold", t.text)}>{formatMXN0(data.profit)}</span>
          </div>
        </div>
        <Link to="/gastos" className="text-xs text-primary hover:underline shrink-0">Ver gastos →</Link>
      </CardContent>
    </Card>
  );
}