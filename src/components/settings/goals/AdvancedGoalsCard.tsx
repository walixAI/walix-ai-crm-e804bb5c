import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Target, Lock, Layers, KanbanSquare, Package } from "lucide-react";
import { toast } from "sonner";
import { useMonthlyGoals, useDeleteMonthlyGoal, type MonthlyGoal } from "@/lib/queries/monthlyGoals";
import { usePipelines } from "@/lib/queries/pipeline";
import { useProductCategories } from "@/lib/queries/monthlyGoals";
import { GoalBuilderDialog } from "./GoalBuilderDialog";
import { GoalAssignmentsList } from "./GoalAssignmentsList";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DEAL_TYPE_LABEL: Record<string, string> = { venta: "Venta", servicio: "Servicio / Mantenimiento", refaccion: "Refacción" };

function periodLabel(y: number, m: number) { return `${MONTHS[m - 1]} ${y}`; }
function shiftPeriod(y: number, m: number, delta: number) {
  const d = new Date(y, m - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
function isPast(y: number, m: number) {
  const now = new Date();
  return y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1);
}
function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

const DIM_ICON: Record<string, any> = {
  global: Target, deal_type: Layers, pipeline: KanbanSquare, product_category: Package,
};

export function AdvancedGoalsCard() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [editing, setEditing] = useState<MonthlyGoal | null>(null);
  const [open, setOpen] = useState(false);
  const past = isPast(year, month);

  const { data: goals = [], isLoading } = useMonthlyGoals(year, month);
  const { data: pipelines = [] } = usePipelines();
  const { data: categories = [] } = useProductCategories();
  const del = useDeleteMonthlyGoal();

  const yearOptions = useMemo(() => {
    const y = today.getFullYear();
    return [y - 1, y, y + 1];
  }, [today]);

  const grouped = useMemo(() => {
    const g: Record<string, MonthlyGoal[]> = { global: [], deal_type: [], pipeline: [], product_category: [] };
    goals.forEach((x) => g[x.dimension].push(x));
    return g;
  }, [goals]);

  function labelFor(goal: MonthlyGoal): string {
    if (goal.dimension === "global") return "Meta global";
    if (goal.dimension === "deal_type") return DEAL_TYPE_LABEL[goal.dimension_value_text ?? ""] ?? goal.dimension_value_text ?? "—";
    if (goal.dimension === "pipeline") return pipelines.find((p: any) => p.id === goal.dimension_value_uuid)?.name ?? "Pipeline";
    if (goal.dimension === "product_category") return categories.find((c) => c.id === goal.dimension_value_uuid)?.name ?? "Categoría";
    return "";
  }

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(g: MonthlyGoal) { setEditing(g); setOpen(true); }

  async function onDelete(g: MonthlyGoal) {
    if (!confirm(`¿Eliminar meta "${labelFor(g)}" de ${periodLabel(year, month)}?`)) return;
    try {
      await del.mutateAsync(g.id);
      toast.success("Meta eliminada");
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Metas por dimensión y agente
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => { const p = shiftPeriod(year, month, -1); setYear(p.year); setMonth(p.month); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => { const p = shiftPeriod(year, month, 1); setYear(p.year); setMonth(p.month); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" className="ml-2" onClick={openNew} disabled={past}>
              <Plus className="h-4 w-4 mr-1" /> Nueva meta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {past && (
            <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-3 text-sm">
              <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>Las metas de meses pasados no se pueden modificar; están en modo lectura.</div>
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : goals.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              Sin metas para {periodLabel(year, month)}. Crea una para empezar a repartirla entre agentes.
            </div>
          ) : (
            <div className="space-y-4">
              {(["global","deal_type","pipeline","product_category"] as const).map((dim) => {
                const list = grouped[dim];
                if (list.length === 0) return null;
                const Icon = DIM_ICON[dim];
                const title = { global: "Meta global", deal_type: "Por tipo de deal", pipeline: "Por pipeline", product_category: "Por categoría / producto" }[dim];
                return (
                  <div key={dim}>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" /> {title}
                    </div>
                    <div className="divide-y divide-border rounded-md border">
                      {list.map((g) => (
                        <div key={g.id}>
                          <div className="flex items-center justify-between px-3 py-2 gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">
                                {labelFor(g)}
                                {g.is_draft && <span className="ml-2 text-[10px] rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.5">Borrador</span>}
                              </div>
                              {g.notes && <div className="text-xs text-muted-foreground truncate italic">"{g.notes}"</div>}
                            </div>
                            <div className="text-sm font-semibold tabular-nums">{formatMXN(Number(g.amount))}</div>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(g)} disabled={past}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => onDelete(g)} disabled={past}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          <GoalAssignmentsList goalId={g.id} amount={Number(g.amount)} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <GoalBuilderDialog open={open} onOpenChange={setOpen} year={year} month={month} goal={editing} />
    </>
  );
}