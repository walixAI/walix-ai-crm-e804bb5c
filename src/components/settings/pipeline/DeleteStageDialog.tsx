import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useStageImpact, useDeleteStageSafely, type OutcomeAction } from "@/lib/queries/pipelineStages";

interface Props {
  open: boolean;
  onClose: () => void;
  stage: { id: string; name: string } | null;
  otherStages: { id: string; name: string }[];
  pipelineId: string;
  onDeleted: () => void;
}

export function DeleteStageDialog({ open, onClose, stage, otherStages, pipelineId, onDeleted }: Props) {
  const { data: impact, isLoading } = useStageImpact(open ? stage?.id ?? null : null);
  const del = useDeleteStageSafely();
  const [targetId, setTargetId] = useState<string>("");
  const [action, setAction] = useState<OutcomeAction>("move");

  const needsTarget = (impact?.dealsCount ?? 0) > 0;
  const targets = otherStages.filter((s) => s.id !== stage?.id && !s.id.startsWith("tmp-"));

  async function handleDelete() {
    if (!stage) return;
    if (needsTarget && !targetId) {
      toast.error("Elige la etapa destino para las oportunidades");
      return;
    }
    try {
      const res = await del.mutateAsync({
        stageId: stage.id,
        targetStageId: targetId || null,
        outcomeAction: action,
        pipelineId,
      });
      toast.success("Etapa eliminada", {
        description: `${res.deals_moved} oportunidad(es) movidas · ${res.outcomes_affected} tipificación(es) ajustadas${res.rules_disabled ? ` · ${res.rules_disabled} regla(s) desactivadas` : ""}`,
      });
      setTargetId("");
      setAction("move");
      onDeleted();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar la etapa");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Eliminar "{stage?.name}"
          </DialogTitle>
          <DialogDescription>
            Revisa qué depende de esta etapa antes de eliminarla.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando impacto...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border p-2">
                <div className="text-lg font-semibold">{impact?.dealsCount ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Oportunidades</div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <div className="text-lg font-semibold">{impact?.outcomesCount ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Tipificaciones</div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <div className="text-lg font-semibold">{impact?.rulesCount ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Reglas de avance</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Etapa destino {needsTarget ? "(obligatoria)" : "(opcional)"}
              </Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecciona a dónde se mueven las oportunidades" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(impact?.outcomesTargetingCount ?? 0) > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {impact?.outcomesTargetingCount} tipificación(es) que movían a esta etapa se reapuntarán al destino.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Tipificaciones de esta etapa</Label>
              <RadioGroup value={action} onValueChange={(v) => setAction(v as OutcomeAction)} className="space-y-1.5">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="move" className="mt-0.5" />
                  <span>Mover a la etapa destino <span className="text-muted-foreground">(recomendado)</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="generalize" className="mt-0.5" />
                  <span>Convertirlas en generales (disponibles en todas las etapas)</span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="delete" className="mt-0.5" />
                  <span>Eliminarlas</span>
                </label>
              </RadioGroup>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={del.isPending || isLoading}
          >
            {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Eliminar etapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
