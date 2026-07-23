import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, Zap } from "lucide-react";
import {
  useExpenseRules, useUpsertRule, useDeleteRule,
  useAllExpenseCategories, type ExpenseRule, type RuleType,
} from "@/lib/queries/expenses";
import { toast } from "sonner";

function ruleDescription(r: Partial<ExpenseRule>, catName?: string) {
  const scope = r.deal_type_filter === "venta" ? "cada venta"
    : r.deal_type_filter === "servicio" ? "cada servicio"
    : "cada deal ganado";
  const cat = catName ?? "Sin categoría";
  if (r.rule_type === "percent_of_deal") return `Por ${scope}, agrega ${r.value}% del monto en "${cat}".`;
  if (r.rule_type === "fixed_per_deal") return `Por ${scope}, agrega $${Number(r.value ?? 0).toLocaleString("es-MX")} en "${cat}".`;
  if (r.rule_type === "percent_of_cost") return `Por ${scope}, agrega ${r.value}% del costo del producto en "${cat}".`;
  return "";
}

export function ExpenseRulesTab() {
  const { data: rules = [], isLoading } = useExpenseRules();
  const { data: cats = [] } = useAllExpenseCategories();
  const upsert = useUpsertRule();
  const del = useDeleteRule();
  const varCats = cats.filter(c => c.kind === "variable");

  const [editing, setEditing] = useState<Partial<ExpenseRule> | null>(null);

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) { toast.error("Nombre requerido"); return; }
    if (!editing.category_id) { toast.error("Selecciona categoría"); return; }
    if (!editing.rule_type) { toast.error("Selecciona tipo de regla"); return; }
    if (editing.value == null || Number(editing.value) < 0) { toast.error("Valor inválido"); return; }
    try {
      await upsert.mutateAsync({
        id: editing.id, name: editing.name.trim(), rule_type: editing.rule_type,
        value: Number(editing.value), category_id: editing.category_id,
        deal_type_filter: (editing.deal_type_filter as any) ?? null,
        auto_confirm: editing.auto_confirm ?? false, is_active: editing.is_active ?? true,
      });
      toast.success(editing.id ? "Actualizada" : "Regla creada");
      setEditing(null);
    } catch (e: any) { toast.error(e.message ?? "Error"); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            Cuando un deal se marque como ganado, se generarán automáticamente los gastos variables asociados según estas reglas.
            Por defecto quedan como <b>borrador</b> para que revises el monto antes de confirmarlos.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Reglas por venta/servicio</CardTitle>
          {!editing && (
            <Button size="sm" onClick={() => setEditing({
              name: "", rule_type: "percent_of_deal", value: 0,
              category_id: null, deal_type_filter: null, auto_confirm: false, is_active: true,
            })}><Plus className="h-4 w-4 mr-1" /> Nueva regla</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {editing && (
            <div className="rounded-lg border-2 border-primary/60 p-4 space-y-3 bg-muted/30">
              <div>
                <Label>Nombre</Label>
                <Input value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ej. Comisión vendedor, Viáticos servicio" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoría</Label>
                  <Select value={editing.category_id ?? ""} onValueChange={v => setEditing({ ...editing, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                    <SelectContent>
                      {varCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Aplicar a</Label>
                  <Select value={editing.deal_type_filter ?? "all"} onValueChange={v => setEditing({ ...editing, deal_type_filter: v === "all" ? null : v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los deals</SelectItem>
                      <SelectItem value="venta">Solo ventas nuevas</SelectItem>
                      <SelectItem value="servicio">Solo servicios/mantenimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de regla</Label>
                  <Select value={editing.rule_type ?? "percent_of_deal"} onValueChange={v => setEditing({ ...editing, rule_type: v as RuleType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent_of_deal">% del monto del deal</SelectItem>
                      <SelectItem value="fixed_per_deal">Monto fijo por deal</SelectItem>
                      <SelectItem value="percent_of_cost">% del costo del producto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{editing.rule_type === "fixed_per_deal" ? "Monto (MXN)" : "Porcentaje (%)"}</Label>
                  <Input type="number" min={0} step="0.01" value={editing.value ?? 0}
                    onChange={e => setEditing({ ...editing, value: Number(e.target.value) })} />
                </div>
              </div>
              <div className="rounded-md bg-background p-3 text-sm border">
                <span className="text-muted-foreground">Vista previa: </span>
                {ruleDescription(editing, cats.find(c => c.id === editing.category_id)?.name)}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.auto_confirm ?? false} onCheckedChange={v => setEditing({ ...editing, auto_confirm: v })} />
                  Auto-confirmar (sin revisión)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_active ?? true} onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
                  Activa
                </label>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button onClick={save}><Check className="h-4 w-4 mr-1" /> Guardar</Button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? <div className="text-muted-foreground">Cargando...</div> :
            rules.length === 0 && !editing ? (
              <div className="text-center text-muted-foreground py-8">
                Sin reglas. Crea una para automatizar los gastos por cada deal ganado.
              </div>
            ) : (
              rules.map(r => (
                <div key={r.id} className={`flex items-start gap-3 rounded-lg border p-3 ${!r.is_active ? "opacity-60" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ruleDescription(r, cats.find(c => c.id === r.category_id)?.name)}
                    </div>
                    <div className="text-xs mt-1 flex gap-2">
                      {r.auto_confirm
                        ? <span className="text-emerald-600">● Auto-confirmar</span>
                        : <span className="text-amber-600">● Genera borrador</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(`¿Eliminar la regla "${r.name}"?`)) return;
                    try { await del.mutateAsync(r.id); toast.success("Eliminada"); }
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