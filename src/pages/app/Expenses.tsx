import { useMemo, useState } from "react";
import { Plus, Trash2, Filter, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useExpenses, useExpenseCategories, useDeleteExpense, formatMXN0,
  useDraftExpenses, useConfirmExpense, useConfirmAllDrafts,
} from "@/lib/queries/expenses";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { ProfitabilityCard } from "@/components/walix/ProfitabilityCard";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function Expenses() {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kind, setKind] = useState<"all" | "fijo" | "variable">("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const monthDate = useMemo(() => new Date(`${month}-01T00:00:00`), [month]);
  const { data: expenses = [], isLoading } = useExpenses({
    month: monthDate, kind, categoryId: categoryId === "all" ? null : categoryId, status: "confirmed",
  });
  const { data: cats = [] } = useExpenseCategories();
  const del = useDeleteExpense();
  const { data: drafts = [] } = useDraftExpenses();
  const confirmOne = useConfirmExpense();
  const confirmAll = useConfirmAllDrafts();

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalsByCat = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => {
      const k = e.category_id ?? "sin";
      map.set(k, (map.get(k) ?? 0) + Number(e.amount));
    });
    return Array.from(map.entries()).map(([id, amt]) => ({
      id, amount: amt, name: cats.find(c => c.id === id)?.name ?? "Sin categoría",
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses, cats]);

  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gastos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Captura gastos fijos y variables para monitorear tu rentabilidad.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nuevo gasto</Button>
      </div>

      <ProfitabilityCard />

      {drafts.length > 0 && (
        <Card className="border-amber-500/60 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              {drafts.length} gasto{drafts.length === 1 ? "" : "s"} por confirmar
            </CardTitle>
            <Button size="sm" variant="outline" onClick={async () => {
              try { await confirmAll.mutateAsync(); toast.success("Todos confirmados"); }
              catch (e: any) { toast.error(e.message); }
            }}><Check className="h-4 w-4 mr-1" /> Confirmar todos</Button>
          </CardHeader>
          <CardContent className="divide-y">
            {drafts.map(d => (
              <div key={d.id} className="flex items-center gap-3 py-2.5">
                <div className="w-20 text-xs text-muted-foreground">{format(new Date(d.incurred_at), "dd MMM", { locale: es })}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{catName(d.category_id)}</div>
                  {d.description && <div className="text-xs text-muted-foreground truncate">{d.description}</div>}
                </div>
                <div className="text-right font-bold w-28">{formatMXN0(Number(d.amount))}</div>
                <Button size="sm" onClick={async () => {
                  try { await confirmOne.mutateAsync({ id: d.id }); toast.success("Confirmado"); }
                  catch (e: any) { toast.error(e.message); }
                }}><Check className="h-4 w-4 mr-1" /> Confirmar</Button>
                <Button size="icon" variant="ghost" onClick={async () => {
                  if (!confirm("¿Descartar este gasto borrador?")) return;
                  try { await del.mutateAsync(d.id); toast.success("Descartado"); }
                  catch (e: any) { toast.error(e.message); }
                }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros</CardTitle>
          <div className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{formatMXN0(total)}</span></div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="fijo">Fijos</SelectItem>
              <SelectItem value="variable">Variables</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.kind})</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {totalsByCat.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Total por categoría</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {totalsByCat.map(c => (
              <div key={c.id} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                <div className="text-lg font-bold">{formatMXN0(c.amount)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Movimientos</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <div className="text-center text-muted-foreground py-8">Cargando...</div>}
          {!isLoading && expenses.length === 0 && (
            <div className="text-center text-muted-foreground py-8">Sin gastos en el periodo.</div>
          )}
          {expenses.length > 0 && (
            <div className="divide-y">
              {expenses.map(e => (
                <div key={e.id} className="flex items-center gap-4 py-3">
                  <div className="w-24 text-xs text-muted-foreground">{format(new Date(e.incurred_at), "dd MMM", { locale: es })}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{catName(e.category_id)}</div>
                    {e.description && <div className="text-xs text-muted-foreground truncate">{e.description}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.kind === "fijo" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"}`}>{e.kind}</span>
                  <div className="text-right font-bold w-28">{formatMXN0(Number(e.amount))}</div>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm("¿Eliminar este gasto?")) return;
                    try { await del.mutateAsync(e.id); toast.success("Eliminado"); }
                    catch (err: any) { toast.error(err.message ?? "Error"); }
                  }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}