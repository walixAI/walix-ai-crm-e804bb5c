import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateDeal, type PipelineDeal } from "@/lib/queries/pipeline";
import { useLogDealFieldChange } from "@/lib/queries/dealFieldHistory";

/** Edición rápida del nombre y monto de una oportunidad (disponible para asesores). */
export function EditDealQuickDialog({ deal, onClose }: { deal: PipelineDeal | null; onClose: () => void }) {
  const update = useUpdateDeal();
  const logFieldChange = useLogDealFieldChange(deal?.id);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (deal) { setName(deal.name); setAmount(String(deal.amount ?? 0)); }
  }, [deal]);

  const save = async () => {
    if (!deal) return;
    const nextName = name.trim();
    const nextAmount = Number(amount) || 0;
    const patch: Record<string, any> = {};
    if (nextName && nextName !== deal.name) patch.name = nextName;
    if (nextAmount !== deal.amount) patch.amount = nextAmount;
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Editar oportunidad</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="deal-name">Nombre</Label>
            <Input id="deal-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
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
