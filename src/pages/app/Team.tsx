import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Trophy, TrendingUp, TrendingDown, Users2 } from "lucide-react";
import { useTeamPerformance, type UserPerfRow } from "@/lib/queries/teamPerformance";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}
function shiftPeriod(y: number, m: number, delta: number) {
  const d = new Date(y, m - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
function statusColor(pct: number) {
  if (pct >= 100) return "text-emerald-600";
  if (pct >= 80) return "text-amber-600";
  return "text-red-600";
}
function marginColor(pct: number) {
  if (pct >= 20) return "text-emerald-600";
  if (pct >= 10) return "text-amber-600";
  return "text-red-600";
}

type SortKey = "run_rate_pct" | "margin_pct" | "won_amount" | "forecast_pct";

export default function Team() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sortBy, setSortBy] = useState<SortKey>("run_rate_pct");

  const { data: rows = [], isLoading } = useTeamPerformance(year, month);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
  }, [rows, sortBy]);

  const yearOptions = useMemo(() => {
    const y = today.getFullYear();
    return [y - 1, y, y + 1];
  }, [today]);

  const totals = useMemo(() => {
    const g = rows.reduce((s, r) => s + r.assigned_goal, 0);
    const w = rows.reduce((s, r) => s + r.won_amount, 0);
    const e = rows.reduce((s, r) => s + r.expenses, 0);
    return { goal: g, won: w, expenses: e, rr: g > 0 ? (w / g) * 100 : 0, mg: w > 0 ? ((w - e) / w) * 100 : 0 };
  }, [rows]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" /> Tablero del equipo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run Rate y rentabilidad por vendedor · {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => { const p = shiftPeriod(year, month, -1); setYear(p.year); setMonth(p.month); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={() => { const p = shiftPeriod(year, month, 1); setYear(p.year); setMonth(p.month); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Meta equipo" value={formatMXN(totals.goal)} />
        <SummaryTile label="Ganado" value={formatMXN(totals.won)} />
        <SummaryTile label="Run Rate" value={`${totals.rr.toFixed(1)}%`} valueClass={statusColor(totals.rr)} />
        <SummaryTile label="Margen" value={`${totals.mg.toFixed(1)}%`} valueClass={marginColor(totals.mg)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Ranking
          </CardTitle>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="run_rate_pct">Ordenar por Run Rate</SelectItem>
              <SelectItem value="forecast_pct">Ordenar por pronóstico</SelectItem>
              <SelectItem value="margin_pct">Ordenar por margen</SelectItem>
              <SelectItem value="won_amount">Ordenar por ventas ganadas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Calculando...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center italic">Sin vendedores activos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Vendedor</th>
                    <th className="py-2 pr-3 text-right">Meta</th>
                    <th className="py-2 pr-3 text-right">Ganado</th>
                    <th className="py-2 pr-3 text-right">Run Rate</th>
                    <th className="py-2 pr-3 text-right">Pronóstico</th>
                    <th className="py-2 pr-3 text-right">Gastos</th>
                    <th className="py-2 pr-3 text-right">Margen</th>
                    <th className="py-2 pr-3 text-right">Pipeline abierto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((r: UserPerfRow, i) => (
                    <tr key={r.user_id} className="hover:bg-muted/40">
                      <td className="py-2.5 pr-3 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7">
                            {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                            <AvatarFallback className="text-[10px]">{(r.full_name ?? r.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.full_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground truncate">{r.email ?? ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatMXN(r.assigned_goal)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{formatMXN(r.won_amount)}</td>
                      <td className={`py-2.5 pr-3 text-right tabular-nums font-semibold ${statusColor(r.run_rate_pct)}`}>{r.run_rate_pct.toFixed(1)}%</td>
                      <td className={`py-2.5 pr-3 text-right tabular-nums ${statusColor(r.forecast_pct)}`}>
                        <span className="inline-flex items-center gap-1">
                          {r.forecast_pct >= 100 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {r.forecast_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatMXN(r.expenses)}</td>
                      <td className={`py-2.5 pr-3 text-right tabular-nums font-semibold ${marginColor(r.margin_pct)}`}>{r.margin_pct.toFixed(1)}%</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatMXN(r.open_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold tabular-nums mt-1 ${valueClass ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}