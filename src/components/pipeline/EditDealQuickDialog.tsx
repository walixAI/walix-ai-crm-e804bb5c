import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateDeal, type PipelineDeal } from "@/lib/queries/pipeline";
import { useLogDealFieldChange } from "@/lib/queries/dealFieldHistory";
import { useProductCategories } from "@/lib/queries/monthlyGoals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "none";
const FREQUENCIES = [
  { months: 1, label: "Mensual" }, { months: 3, label: "Trimestral" },
  { months: 6, label: "Semestral" }, { months: 12, label: "Anual" },
];

/** Edición rápida del nombre y monto de una oportunidad (disponible para asesores). */
export function EditDealQuickDialog({ deal, onClose }: { deal: PipelineDeal | null; onClose: () => void }) {
  const update = useUpdateDeal();
  const logFieldChange = useLogDealFieldChange(deal?.id);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(NONE);
  const [frequency, setFrequency] = useState(NONE);
  const { data: categories = [] } = useProductCategories();
  useEffect(() => {
    if (deal) {
      setName(deal.name); setAmount(String(deal.amount ?? 0));
      setCategory(deal.productCategoryId ?? NONE);
      setFrequency(deal.serviceFrequencyMonths ? String(deal.serviceFrequencyMonths) : NONE);
    }
  }, [deal]);

  const save = async () => {
    if (!deal) return;
    const nextName = name.trim();
    const nextAmount = Number(amount);
    if (!nextName) { toast.error("Escribe el nombre de la oportunidad"); return; }
    if (!amount.trim() || !Number.isFinite(nextAmount) || nextAmount < 0) { toast.error("Captura un monto válido"); return; }
    const patch: Record<string, any> = {};
    if (nextName && nextName !== deal.name) patch.name = nextName;
    if (nextAmount !== deal.amount) patch.amount = nextAmount;
    const nextCategory = category === NONE ? null : category;
    const nextFrequency = frequency === NONE ? null : Number(frequency);
    if (nextCategory !== (deal.productCategoryId ?? null)) patch.product_category_id = nextCategory;
    if (nextFrequency !== (deal.serviceFrequencyMonths ?? null)) patch.service_frequency_months = nextFrequency;
    if (!Object.keys(patch).length) return onClose();
    try {
      await update.mutateAsync({ dealId: deal.id, patch });
      if ("amount" in patch) {
        await logFieldChange.mutateAsync({
          field: "amount", from: String(deal.amount), to: String(nextAmount), contactId: deal.contactId,
          description: `Monto actualizado de ${deal.amount} a ${nextAmount}`,
        }).catch(() => {});
      }
      toast.success("Oportunidad actualizada");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  return (
    <Dialog open={!!deal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm bg-muted">
        <DialogHeader><DialogTitle>Oportunidad</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="deal-name">Nombre</Label>
            <Input id="deal-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Categoría"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin categoría</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frecuencia</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger aria-label="Frecuencia"><SelectValue placeholder="Sin recurrencia" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin recurrencia</SelectItem>
                  {FREQUENCIES.map((f) => <SelectItem key={f.months} value={String(f.months)}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Si no cambias el nombre, Walix lo arma con la categoría, la frecuencia y el mes.</p>
          <div className="space-y-1.5">
            <Label htmlFor="deal-amount">Monto</Label>
            <Input id="deal-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={update.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
