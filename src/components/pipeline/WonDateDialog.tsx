import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useMarkDealWon, type PipelineDeal, type PipelineStage } from "@/lib/queries/pipeline";

interface Props {
  deal: PipelineDeal | null;
  stage: PipelineStage | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Confirma el cierre ganado. Por default usa la fecha/hora actual; el usuario
 *  puede elegir una fecha anterior (nunca futura) con el botón de calendario. */
export function WonDateDialog({ deal, stage, open, onOpenChange }: Props) {
  const markWon = useMarkDealWon();
  const [useCustom, setUseCustom] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (open) { setUseCustom(false); setDate(undefined); }
  }, [open]);

  async function confirm() {
    if (!deal || !stage) return;
    let wonAt: Date | null = null;
    if (useCustom) {
      if (!date) return toast.error("Elige la fecha de cierre");
      // Conservamos hora de fin de día para la fecha elegida, sin pasar del ahora.
      const picked = new Date(date);
      picked.setHours(23, 59, 0, 0);
      const now = new Date();
      wonAt = picked > now ? now : picked;
    }
    try {
      await markWon.mutateAsync({ dealId: deal.id, stage, wonAt });
      toast.success(`🎉 ¡Ganaste ${deal.name}!`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo marcar como ganada");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Marcar como ganada
          </DialogTitle>
          <DialogDescription>
            {deal?.name} se moverá a la etapa “{stage?.name}”. La fecha de cierre define en qué mes
            se contabiliza la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm">
            <div className="font-medium">Fecha de cierre</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {useCustom && date
                ? format(date, "dd/MM/yyyy", { locale: es })
                : `Hoy — ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`}
            </div>
          </div>

          {!useCustom ? (
            <Button variant="outline" size="sm" onClick={() => setUseCustom(true)}>
              <CalendarIcon className="h-3.5 w-3.5" /> Usar una fecha anterior
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {date ? format(date, "dd/MM/yyyy", { locale: es }) : "Elegir fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    locale={es}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="sm" onClick={() => { setUseCustom(false); setDate(undefined); }}>
                Usar hoy
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={markWon.isPending}>Confirmar ganada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}