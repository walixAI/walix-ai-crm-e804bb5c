import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DollarSign, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRegisterDealPayment, type RegisterPaymentInput } from "@/lib/queries/collect";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal: { id: string; title: string; amount: number } | null;
}

export function RegisterPaymentDialog({ open, onOpenChange, deal }: Props) {
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<RegisterPaymentInput["method"]>("transferencia");
  const [reference, setReference] = useState("");
  const register = useRegisterDealPayment();

  useEffect(() => {
    if (open && deal) {
      setAmount(String(deal.amount ?? ""));
      setMethod("transferencia");
      setReference("");
    }
  }, [open, deal?.id]); // eslint-disable-line

  async function submit() {
    if (!deal) return;
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("Escribe un monto válido"); return; }
    try {
      const res = await register.mutateAsync({
        dealId: deal.id,
        amount: n,
        method,
        reference: reference.trim() || undefined,
      });
      toast.success(res.fullyPaid ? "Pago registrado y deal ganado" : "Pago parcial registrado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo registrar el pago");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" /> Registrar pago
          </DialogTitle>
        </DialogHeader>
        {deal && (
          <p className="text-sm text-muted-foreground -mt-2">
            {deal.title} · Total <b>${deal.amount.toLocaleString("es-MX")}</b>
          </p>
        )}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-base">Monto recibido</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="text-2xl h-14 font-semibold"
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia (opc.)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Folio / últimos 4" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="lg" onClick={submit} disabled={register.isPending}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {register.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}