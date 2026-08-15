import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useProductCategories } from "@/lib/queries/monthlyGoals";
import type { PipelineDeal } from "@/lib/queries/pipeline";

interface Props {
  deal: PipelineDeal | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Se llama cuando la categoría quedó guardada; continúa el movimiento de etapa. */
  onSaved: () => void;
}

/** Bloquea el cambio de etapa hasta que la oportunidad tenga categoría. */
export function RequireCategoryDialog({ deal, open, onOpenChange, onSaved }: Props) {
  const { data: categories = [] } = useProductCategories();
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { if (open) setCategoryId(""); }, [open]);

  async function confirm() {
    if (!deal) return;
    if (!categoryId) { toast.error("Selecciona una categoría"); return; }
    setSaving(true);
    const { error } = await supabase.from("deals").update({ product_category_id: categoryId }).eq("id", deal.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    qc.invalidateQueries({ queryKey: ["pipeline-deal", deal.id] });
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Captura la categoría
          </DialogTitle>
          <DialogDescription>
            Para mover “{deal?.name}” primero indica su categoría / producto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Categoría / producto*</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {categories.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              No hay categorías activas. Crea una en Configuración › Categorías.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || !categoryId}>Guardar y mover</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}