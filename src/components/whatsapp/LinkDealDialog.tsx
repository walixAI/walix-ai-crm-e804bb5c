import { useEffect, useState } from "react";
import { Plus, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContactDeals } from "@/lib/queries/contacts";
import { useStages, useCreateDeal } from "@/lib/queries/pipeline";
import { useLinkDealToConversation } from "@/lib/queries/whatsapp";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  conversationId: string;
  contactId: string;
  contactName: string;
  currentDealId: string | null;
}

export function LinkDealDialog({ open, onOpenChange, conversationId, contactId, contactName, currentDealId }: Props) {
  const [tab, setTab] = useState<"link" | "create">("link");
  const { data: deals = [] } = useContactDeals(contactId);
  const { data: stages = [] } = useStages();
  const link = useLinkDealToConversation();
  const create = useCreateDeal();

  // create form
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [stageId, setStageId] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setTab(deals.length ? "link" : "create");
      setName(""); setAmount(""); setStageId(stages[0]?.id ?? "");
    } else {
      setStageId(stages[0]?.id ?? "");
      setTab(deals.length ? "link" : "create");
    }
  }, [open, deals.length, stages]);

  async function onLink(dealId: string | null) {
    try {
      await link.mutateAsync({ conversationId, dealId });
      toast.success(dealId ? "Oportunidad vinculado" : "Vinculación eliminada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  async function onCreate() {
    if (!name.trim() || !amount || !stageId) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    try {
      const created: any = await create.mutateAsync({
        name: name.trim(),
        amount: Number(amount),
        probability: 50,
        stageId,
        contactId,
        expectedCloseDate: null,
        source: "WhatsApp",
        notes: `Creado desde la conversación con ${contactName}`,
      });
      const newDealId = created?.id ?? created?.[0]?.id;
      if (newDealId) {
        await link.mutateAsync({ conversationId, dealId: newDealId });
      }
      toast.success("Oportunidad creado y vinculado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el oportunidad");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular deal</DialogTitle>
          <DialogDescription>
            Asocia un deal existente o crea uno nuevo desde esta conversación con <span className="font-medium">{contactName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setTab("link")}
            className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition ${tab === "link" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Vincular existente
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition ${tab === "create" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Crear nuevo
          </button>
        </div>

        {tab === "link" && (
          <div className="space-y-2">
            {deals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Este contacto aún no tiene deals.</p>
            )}
            <ScrollArea className="max-h-[280px]">
              <ul className="space-y-1.5">
                {deals.map((d) => {
                  const isCurrent = d.id === currentDealId;
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => onLink(isCurrent ? null : d.id)}
                        className={`w-full text-left border rounded-lg px-3 py-2 hover:bg-muted/40 transition flex items-center gap-3 ${isCurrent ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.stage} · {fmt(d.amount)}</p>
                        </div>
                        {isCurrent ? (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <Check className="h-3 w-3" /> Vinculado
                          </span>
                        ) : (
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
            {currentDealId && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => onLink(null)}>
                Quitar vinculación
              </Button>
            )}
          </div>
        )}

        {tab === "create" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre del deal*</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Plan anual Premium" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto MXN*</Label>
                <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Etapa*</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={onCreate} disabled={create.isPending || link.isPending} className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              Crear y vincular
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
