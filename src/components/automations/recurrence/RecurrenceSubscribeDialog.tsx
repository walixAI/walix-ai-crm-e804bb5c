import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useContacts } from "@/lib/queries/contacts";
import { useCreateRecurrenceSubscription, type RecurrenceSubscription } from "@/lib/queries/recurrenceSubscriptions";
import { useTenantUsers } from "@/lib/queries/tenant";
import type { RecurrenceDefinition } from "@/lib/queries/recurrence";
import { CalendarDays, UserPlus, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  recurrence: RecurrenceDefinition;
}

export function RecurrenceSubscribeDialog({ open, onClose, recurrence }: Props) {
  const { toast } = useToast();
  const { data: contacts = [] } = useContacts();
  const { data: users = [] } = useTenantUsers();
  const create = useCreateRecurrenceSubscription();

  const [selectedContactId, setSelectedContactId] = useState("");
  const [nextDueDate, setNextDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + recurrence.anticipation_days);
    return d.toISOString().slice(0, 10);
  });
  const [equipmentNote, setEquipmentNote] = useState("");

  const reset = () => {
    setSelectedContactId("");
    setEquipmentNote("");
    const d = new Date();
    d.setDate(d.getDate() + recurrence.anticipation_days);
    setNextDueDate(d.toISOString().slice(0, 10));
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async () => {
    if (!selectedContactId) {
      toast({ title: "Selecciona un contacto", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        recurrence_id: recurrence.id,
        contact_id: selectedContactId,
        entity_type: "contact",
        entity_id: selectedContactId,
        next_due_date: nextDueDate,
        metadata: { equipment_note: equipmentNote || null },
      } as Partial<RecurrenceSubscription>);
      toast({ title: "Contacto suscrito al servicio recurrente" });
      handleClose();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Suscribir contacto a {recurrence.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sub-contact">Contacto</Label>
            <select
              id="sub-contact"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
            >
              <option value="">Selecciona un contacto...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-date" className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> Próxima fecha de vencimiento
            </Label>
            <Input id="sub-date" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-equipment">Equipo / nota (opcional)</Label>
            <Input id="sub-equipment" value={equipmentNote} onChange={(e) => setEquipmentNote(e.target.value)} placeholder="Ej. Refrigerador Sub-Zero modelo 648PRO" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Suscribir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
