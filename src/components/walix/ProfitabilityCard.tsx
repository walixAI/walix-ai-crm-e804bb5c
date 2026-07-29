import { useState } from "react";
import { PiggyBank, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMonthProfitability, useMonthExpenseBreakdown, formatMXN0 } from "@/lib/queries/expenses";
import { Link } from "react-router-dom";

const TONE = {
  green:  { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Saludable" },
  yellow: { bg: "bg-amber-500/10",   text: "text-amber-600",   label: "En vigilancia" },
  orange: { bg: "bg-orange-500/10",  text: "text-orange-600",  label: "Al límite" },
  red:    { bg: "bg-red-500/10",     text: "text-red-600",     label: "En pérdida" },
} as const;

export function ProfitabilityCard({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useMonthProfitability();
  const { data: breakdown } = useMonthExpenseBreakdown();
  const [open, setOpen] = useState(false);
  if (isLoading || !data) return null;
  const t = TONE[data.status];

  return (
    <Card className="border-2">
      <CardContent className={cn("p-5 space-y-3", compact && "p-4")}>
        <div className="flex items-center gap-4">
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
        </div>

        {breakdown && (
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setOpen((o) => !o)}
              className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {breakdown.scopedToMe ? "Mis gastos del mes" : "Detalle de gastos (fijos, variables y por vendedor)"}
              </span>
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {open && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Mini label="Fijos" value={formatMXN0(breakdown.fijo)} />
                  <Mini label="Variables" value={formatMXN0(breakdown.variable)} />
                  <Mini label="Total" value={formatMXN0(breakdown.total)} tone={t.text} />
                </div>
                {!breakdown.scopedToMe && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Por vendedor</div>
                    {breakdown.bySeller.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Sin gastos registrados este mes.</p>
                    )}
                    {breakdown.bySeller.map((s) => (
                      <div key={s.userId ?? "none"} className="flex items-center justify-between text-xs">
                        <span className="truncate">{s.name}</span>
                        <span className="font-semibold shrink-0">{formatMXN0(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-bold", tone)}>{value}</div>
    </div>
  );
}