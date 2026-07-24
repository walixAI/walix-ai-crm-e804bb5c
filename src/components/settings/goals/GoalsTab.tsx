import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, History, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useTenantGoals, useUpdateGoals,
  useMonthGoal, useMonthGoalHistory, useSaveMonthGoal, isPastPeriod, formatMXN0,
} from "@/lib/queries/expenses";
import { toast } from "sonner";
import { AdvancedGoalsCard } from "./AdvancedGoalsCard";
import { ProductCategoriesCard } from "./ProductCategoriesCard";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function periodLabel(y: number, m: number) {
  return `${MONTHS[m - 1]} ${y}`;
}

function shiftPeriod(y: number, m: number, delta: number) {
  const d = new Date(y, m - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function GoalsTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const past = isPastPeriod(year, month);
  const isCurrent = year === today.getFullYear() && month === today.getMonth() + 1;

  const { data: tenant, isLoading: loadingTenant } = useTenantGoals();
  const updTenant = useUpdateGoals();
  const { data: monthGoal, isLoading: loadingGoal } = useMonthGoal(year, month);
  const { data: history = [] } = useMonthGoalHistory(year, month);
  const saveGoal = useSaveMonthGoal();

  const [total, setTotal] = useState("0");
  const [venta, setVenta] = useState("0");
  const [servicio, setServicio] = useState("0");
  const [refaccion, setRefaccion] = useState("0");
  const [biz, setBiz] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    // Cuando cambia el mes: precargamos con la meta vigente (si existe) o con los defaults del tenant.
    const src: any = monthGoal ?? tenant ?? {};
    setTotal(String(src.monthly_goal_total ?? 0));
    const t = src.monthly_goal_by_type ?? {};
    setVenta(String(t.venta ?? 0));
    setServicio(String(t.servicio ?? 0));
    setRefaccion(String(t.refaccion ?? 0));
    setBiz(src.count_business_days ?? true);
    setNote("");
  }, [monthGoal, tenant]);

  const [green, setGreen] = useState("20");
  const [yellow, setYellow] = useState("10");
  const [orange, setOrange] = useState("0");
  useEffect(() => {
    const th = (tenant as any)?.profit_thresholds ?? {};
    setGreen(String(th.green ?? 20));
    setYellow(String(th.yellow ?? 10));
    setOrange(String(th.orange ?? 0));
  }, [tenant]);

  const yearOptions = useMemo(() => {
    const y = today.getFullYear();
    return [y - 1, y, y + 1];
  }, [today]);

  async function saveNewVersion() {
    if (past) return;
    try {
      await saveGoal.mutateAsync({
        year, month,
        monthly_goal_total: Number(total) || 0,
        monthly_goal_by_type: {
          venta: Number(venta) || 0,
          servicio: Number(servicio) || 0,
          refaccion: Number(refaccion) || 0,
        },
        count_business_days: biz,
        note: note.trim() || null,
      });
      toast.success(`Meta de ${periodLabel(year, month)} guardada`);
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  }

  async function saveThresholds() {
    try {
      await updTenant.mutateAsync({
        monthly_goal_total: Number((tenant as any)?.monthly_goal_total ?? 0),
        monthly_goal_by_type: (tenant as any)?.monthly_goal_by_type ?? { venta: 0, servicio: 0, refaccion: 0 },
        count_business_days: !!(tenant as any)?.count_business_days,
        profit_thresholds: {
          green: Number(green) || 0,
          yellow: Number(yellow) || 0,
          orange: Number(orange) || 0,
        },
      });
      toast.success("Semáforo actualizado");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  }

  if (loadingTenant) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Meta mensual</CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => {
              const p = shiftPeriod(year, month, -1); setYear(p.year); setMonth(p.month);
            }}><ChevronLeft className="h-4 w-4" /></Button>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => {
              const p = shiftPeriod(year, month, 1); setYear(p.year); setMonth(p.month);
            }}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {past && (
            <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-3 text-sm">
              <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                Las metas de meses pasados no se pueden modificar. Estás viendo la última versión guardada de <b>{periodLabel(year, month)}</b> en modo lectura.
              </div>
            </div>
          )}
          {!past && !isCurrent && (
            <div className="text-xs text-muted-foreground">
              Estás editando la meta futura de <b>{periodLabel(year, month)}</b>. Se aplicará automáticamente cuando comience el mes.
            </div>
          )}
          {!past && !monthGoal && (
            <div className="text-xs text-muted-foreground">
              Aún no hay meta definida para este mes; los valores mostrados vienen de tu configuración base. Guarda para fijarlos.
            </div>
          )}

          <fieldset disabled={past} className="space-y-4 disabled:opacity-70">
            <div>
              <Label>Meta total del mes (MXN)</Label>
              <Input type="number" value={total} onChange={e => setTotal(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Se usa para calcular tu Run Rate y proyección de cierre.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label>Meta de ventas</Label><Input type="number" value={venta} onChange={e => setVenta(e.target.value)} /></div>
              <div><Label>Meta de servicios</Label><Input type="number" value={servicio} onChange={e => setServicio(e.target.value)} /></div>
              <div><Label>Meta de refacciones</Label><Input type="number" value={refaccion} onChange={e => setRefaccion(e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={biz} onCheckedChange={setBiz} />
              <Label className="cursor-pointer">Contar solo días hábiles (Lunes a Viernes)</Label>
            </div>
            <div>
              <Label>Nota del cambio (opcional)</Label>
              <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                placeholder="Ej. Ajuste por temporada baja / meta subida por nuevo canal…" />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveNewVersion} disabled={saveGoal.isPending || past}>
                Guardar meta de {periodLabel(year, month)}
              </Button>
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Historial de {periodLabel(year, month)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingGoal ? <div className="text-muted-foreground text-sm">Cargando...</div>
            : history.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin cambios registrados para este mes.</div>
            ) : (
              <ol className="space-y-2">
                {history.map((h, idx) => {
                  const t: any = h.monthly_goal_by_type ?? {};
                  return (
                    <li key={h.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {formatMXN0(Number(h.monthly_goal_total ?? 0))}
                          {idx === 0 && <span className="ml-2 text-xs rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5">Vigente</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Ventas {formatMXN0(Number(t.venta ?? 0))} · Servicios {formatMXN0(Number(t.servicio ?? 0))} · Refacciones {formatMXN0(Number(t.refaccion ?? 0))}
                        {" · "}{h.count_business_days ? "días hábiles" : "días naturales"}
                      </div>
                      {h.note && <div className="text-xs mt-1 italic text-muted-foreground">"{h.note}"</div>}
                    </li>
                  );
                })}
              </ol>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Semáforo de rentabilidad (%)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Verde ≥</Label><Input type="number" value={green} onChange={e => setGreen(e.target.value)} /></div>
            <div><Label>Amarillo ≥</Label><Input type="number" value={yellow} onChange={e => setYellow(e.target.value)} /></div>
            <div><Label>Naranja ≥</Label><Input type="number" value={orange} onChange={e => setOrange(e.target.value)} /></div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={saveThresholds} disabled={updTenant.isPending}>Guardar semáforo</Button>
          </div>
        </CardContent>
      </Card>

      <AdvancedGoalsCard />
      <ProductCategoriesCard />
    </div>
  );
}