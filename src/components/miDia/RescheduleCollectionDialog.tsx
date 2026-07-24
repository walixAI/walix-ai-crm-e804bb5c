import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRescheduleCollection } from "@/lib/queries/collect";
import { toLocalInput, fromLocalInput } from "@/lib/format/localDatetime";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal: { id: string; title: string; currentDate?: string | null } | null;
}

export function RescheduleCollectionDialog({ open, onOpenChange, deal }: Props) {
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const reschedule = useRescheduleCollection();

  useEffect(() => {
    if (open && deal) {
      const base = new Date();
      base.setDate(base.getDate() + 3);
      base.setHours(10, 0, 0, 0);
      setWhen(toLocalInput(base));
      setReason("");
    }
  }, [open, deal?.id]); // eslint-disable-line

  async function submit() {
    if (!deal || !when) return;
    try {
      await reschedule.mutateAsync({
        dealId: deal.id,
        newDate: fromLocalInput(when),
        reason: reason.trim() || undefined,
      });
      toast.success("Cobro reagendado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo reagendar");
    }
  }

  const suggestions = [
    { label: "Mañana 10 am", days: 1, h: 10 },
    { label: "En 3 días", days: 3, h: 10 },
    { label: "Próx. lunes", days: nextMondayDays(), h: 10 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" /> Reagendar cobro
          </DialogTitle>
        </DialogHeader>
        {deal && <p className="text-sm text-muted-foreground -mt-2">{deal.title}</p>}
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s.label} variant="outline" size="sm"
                onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() + s.days); d.setHours(s.h, 0, 0, 0);
                  setWhen(toLocalInput(d));
                }}>
                {s.label}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-base">Nueva fecha y hora</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Cliente pidió pagar el viernes" className="text-base" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="lg" onClick={submit} disabled={reschedule.isPending || !when}>
            <CalendarClock className="mr-1 h-4 w-4" />
            {reschedule.isPending ? "Guardando…" : "Reagendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function nextMondayDays(): number {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun..6=Sat
  const delta = ((8 - dow) % 7) || 7;
  return delta;
}