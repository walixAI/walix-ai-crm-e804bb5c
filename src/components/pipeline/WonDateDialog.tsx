import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CalendarIcon, CheckCircle2 } from "lucide-react";
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

  // Fecha elegida (fin del día) sin pasar del momento actual.
  const picked = (() => {
    if (!useCustom || !date) return null;
    const d = new Date(date);
    d.setHours(23, 59, 0, 0);
    const now = new Date();
    return d > now ? now : d;
  })();
  const createdAt = deal?.createdAt ? new Date(deal.createdAt) : null;
  const beforeCreation = !!(picked && createdAt && picked < createdAt);

  async function confirm() {
    if (!deal || !stage) return;
    let wonAt: Date | null = null;
    if (useCustom) {
      if (!date) return toast.error("Elige la fecha de cierre");
      wonAt = picked;
    }
    try {
      const res = await markWon.mutateAsync({ dealId: deal.id, stage, wonAt });
      toast.success(`🎉 ¡Ganaste ${deal.name}!`);
      if (res?.createdAdjusted) {
        toast.warning(
          `La fecha de cierre era anterior a la creación: ajustamos la fecha de creación a ${
            format(new Date(res.createdAdjusted), "dd/MM/yyyy", { locale: es })
          }.`,
        );
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo marcar como ganada");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* El diálogo se monta dentro de la tarjeta del Kanban: sin esto, los clics
          burbujean por el árbol de React y abren el detalle de la oportunidad. */}
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
                    fromYear={2000}
                    toDate={new Date()}
                    captionLayout="dropdown-buttons"
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

          {beforeCreation && createdAt && (
            <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span>
                La fecha elegida es anterior a la creación de la oportunidad
                ({format(createdAt, "dd/MM/yyyy", { locale: es })}). Al confirmar, la fecha de
                creación se moverá a {format(new Date(picked!.getTime() - 86400000), "dd/MM/yyyy", { locale: es })}
                {" "}(un día antes del cierre).
              </span>
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