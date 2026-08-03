import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X, Repeat } from "lucide-react";
import {
  useRecurringExpenses, useUpsertRecurring, useDeleteRecurring,
  useAllExpenseCategories, formatMXN0, type RecurringExpense,
} from "@/lib/queries/expenses";
import { toast } from "sonner";
import { ExpenseHistoryList } from "@/components/expenses/ExpenseHistoryList";

export function RecurringExpensesTab() {
  const { data: items = [], isLoading } = useRecurringExpenses();
  const { data: cats = [] } = useAllExpenseCategories();
  const upsert = useUpsertRecurring();
  const del = useDeleteRecurring();
  const fijoCats = cats.filter(c => c.kind === "fijo");

  const [editing, setEditing] = useState<Partial<RecurringExpense> | null>(null);

  const totalMonth = items.filter(i => i.is_active).reduce((s, i) => s + Number(i.amount), 0);

  async function save() {
    if (!editing) return;
    if (!editing.category_id) { toast.error("Selecciona categoría"); return; }
    if (!editing.amount || editing.amount <= 0) { toast.error("Monto inválido"); return; }
    if (!editing.day_of_month || editing.day_of_month < 1 || editing.day_of_month > 28) {
      toast.error("Día del mes entre 1 y 28"); return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id, amount: Number(editing.amount), day_of_month: Number(editing.day_of_month),
        category_id: editing.category_id, description: editing.description ?? null,
        is_active: editing.is_active ?? true,
      });
      toast.success(editing.id ? "Actualizado" : "Plantilla creada");
      setEditing(null);
    } catch (e: any) { toast.error(e.message ?? "Error"); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Repeat className="h-5 w-5 text-primary" />
          <div className="flex-1 text-sm">
            Cada día 1 del mes se generarán automáticamente <b>{formatMXN0(totalMonth)}</b> en gastos fijos ({items.filter(i => i.is_active).length} plantillas activas).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Plantillas mensuales</CardTitle>
          {!editing && (
            <Button size="sm" onClick={() => setEditing({ day_of_month: 1, amount: 0, category_id: null, is_active: true })}>
              <Plus className="h-4 w-4 mr-1" /> Nueva
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {editing && (
            <div className="rounded-lg border-2 border-primary/60 p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoría</Label>
                  <Select value={editing.category_id ?? ""} onValueChange={v => setEditing({ ...editing, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                    <SelectContent>
                      {fijoCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Día del mes</Label>
                  <Input type="number" min={1} max={28} value={editing.day_of_month ?? 1}
                    onChange={e => setEditing({ ...editing, day_of_month: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto (MXN)</Label>
                  <Input type="number" min={0} step="0.01" value={editing.amount ?? 0}
                    onChange={e => setEditing({ ...editing, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Input value={editing.description ?? ""} placeholder="Renta local, luz..."
                    onChange={e => setEditing({ ...editing, description: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
                <span className="text-sm">Activa</span>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button onClick={save}><Check className="h-4 w-4 mr-1" /> Guardar</Button>
                </div>
              </div>
              {editing.id && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Historial de cambios</Label>
                  <div className="mt-2 max-h-44 overflow-y-auto">
                    <ExpenseHistoryList targetId={editing.id} />
                  </div>
                </div>
              )}
            </div>
          )}

          {isLoading ? <div className="text-muted-foreground">Cargando...</div> :
            items.length === 0 && !editing ? (
              <div className="text-center text-muted-foreground py-8">
                Sin plantillas. Crea una y se generará automáticamente cada mes.
              </div>
            ) : (
              items.map(i => (
                <div key={i.id} className={`flex items-center gap-3 rounded-lg border p-3 ${!i.is_active ? "opacity-60" : ""}`}>
                  <div className="w-12 h-12 grid place-items-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                    d{i.day_of_month}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{cats.find(c => c.id === i.category_id)?.name ?? "Sin categoría"}</div>
                    {i.description && <div className="text-xs text-muted-foreground truncate">{i.description}</div>}
                  </div>
                  <div className="text-lg font-bold">{formatMXN0(Number(i.amount))}</div>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm("¿Eliminar esta plantilla? No afectará los gastos ya generados.")) return;
                    try { await del.mutateAsync(i.id); toast.success("Eliminada"); }
                    catch (e: any) { toast.error(e.message); }
                  }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              ))
            )}
        </CardContent>
      </Card>
    </div>
  );
}