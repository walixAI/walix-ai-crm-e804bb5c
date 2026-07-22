import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useAllExpenseCategories, useUpsertCategory, useDeleteCategory, type ExpenseCategory } from "@/lib/queries/expenses";
import { toast } from "sonner";

export function ExpenseCategoriesTab() {
  const { data: cats = [], isLoading } = useAllExpenseCategories();
  const upsert = useUpsertCategory();
  const del = useDeleteCategory();
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"fijo" | "variable">("variable");
  const [editing, setEditing] = useState<{ id: string; name: string; kind: "fijo" | "variable" } | null>(null);

  async function add() {
    if (!newName.trim()) { toast.error("Nombre requerido"); return; }
    try { await upsert.mutateAsync({ name: newName.trim(), kind: newKind }); setNewName(""); toast.success("Categoría creada"); }
    catch (e: any) { toast.error(e.message ?? "Error"); }
  }

  async function saveEdit() {
    if (!editing) return;
    try { await upsert.mutateAsync(editing); setEditing(null); toast.success("Guardado"); }
    catch (e: any) { toast.error(e.message ?? "Error"); }
  }

  const fijos = cats.filter(c => c.kind === "fijo");
  const vars = cats.filter(c => c.kind === "variable");

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Nueva categoría</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} />
          <Select value={newKind} onValueChange={(v) => setNewKind(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fijo">Fijo</SelectItem>
              <SelectItem value="variable">Variable</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
        </CardContent>
      </Card>

      {isLoading ? <div className="text-muted-foreground">Cargando...</div> : (
        <div className="grid gap-4 md:grid-cols-2">
          <CategoryList title="Fijos" items={fijos} editing={editing} setEditing={setEditing} saveEdit={saveEdit} del={del.mutateAsync} />
          <CategoryList title="Variables" items={vars} editing={editing} setEditing={setEditing} saveEdit={saveEdit} del={del.mutateAsync} />
        </div>
      )}
    </div>
  );
}

function CategoryList({ title, items, editing, setEditing, saveEdit, del }: any) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Sin categorías.</div>}
        {items.map((c: ExpenseCategory) => (
          <div key={c.id} className="flex items-center gap-2">
            {editing?.id === c.id ? (
              <>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <div className="flex-1 text-sm">{c.name}</div>
                <Button size="icon" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name, kind: c.kind })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={async () => {
                  if (!confirm(`¿Eliminar "${c.name}"?`)) return;
                  try { await del(c.id); toast.success("Eliminada"); } catch (e: any) { toast.error(e.message); }
                }}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}