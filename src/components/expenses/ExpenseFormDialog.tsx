import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useExpenseCategories, useCreateExpense, useUpdateExpense, useExpenseScope,
  type Expense,
} from "@/lib/queries/expenses";
import { toast } from "sonner";
import { ExpenseHistoryList } from "@/components/expenses/ExpenseHistoryList";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Si se pasa, el diálogo edita ese gasto en vez de crear uno nuevo. */
  expense?: Expense | null;
}

export function ExpenseFormDialog({ open, onOpenChange, expense = null }: Props) {
  const { data: cats = [] } = useExpenseCategories();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const { canManageFixed } = useExpenseScope();
  const [kind, setKind] = useState<"fijo" | "variable">("variable");
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setKind(expense?.kind ?? "variable");
      setCategoryId(expense?.category_id ?? "");
      setAmount(expense ? String(expense.amount) : "");
      setDate(expense?.incurred_at ?? new Date().toISOString().slice(0, 10));
      setDescription(expense?.description ?? "");
    }
  }, [open, expense]);

  const filteredCats = cats.filter(c => c.kind === kind);
  const isEdit = !!expense;
  const busy = create.isPending || update.isPending;

  async function handleSubmit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Monto inválido"); return; }
    if (!categoryId) { toast.error("Selecciona una categoría"); return; }
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: expense!.id, category_id: categoryId, amount: amt,
          incurred_at: date, description: description || null,
        });
        toast.success("Gasto actualizado");
      } else {
        await create.mutateAsync({
          kind, category_id: categoryId, amount: amt,
          incurred_at: date, description: description || null,
        });
        toast.success("Gasto registrado");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error al registrar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Editar gasto" : "Nuevo gasto"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {canManageFixed && !isEdit && (
          <div>
            <Label>Tipo</Label>
            <RadioGroup value={kind} onValueChange={(v) => { setKind(v as any); setCategoryId(""); }} className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="fijo" /> Fijo (recurrente)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="variable" /> Variable (por venta/servicio)
              </label>
            </RadioGroup>
          </div>
          )}
          <div>
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
              <SelectContent>
                {filteredCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto (MXN)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle del gasto..." />
          </div>
          {isEdit && (
            <div>
              <Label>Historial de cambios</Label>
              <div className="mt-2 max-h-48 overflow-y-auto">
                <ExpenseHistoryList targetId={expense!.id} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={busy}>{isEdit ? "Guardar cambios" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}