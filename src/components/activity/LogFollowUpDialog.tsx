import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WBadge } from "@/components/walix/Badge";
import { toLocalInput, fromLocalInput } from "@/lib/format/localDatetime";
import { usePipelines, useStages, useContactPipelineDeals } from "@/lib/queries/pipeline";
import {
  ACTIVITY_KINDS, filterOutcomes, useActivityOutcomes, useLogFollowUp,
} from "@/lib/queries/activityOutcomes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: string | null;
  dealId?: string | null;
  stageId?: string | null;
  pipelineId?: string | null;
  /** permite elegir la oportunidad cuando se abre desde el contacto */
  allowDealPicker?: boolean;
}

function defaultNext() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d);
}

export function LogFollowUpDialog({
  open, onOpenChange, contactId, dealId = null, stageId = null, pipelineId = null, allowDealPicker = false,
}: Props) {
  const { data: pipelines = [] } = usePipelines();
  const resolvedPipelineId = pipelineId ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
  const { data: stages = [] } = useStages(resolvedPipelineId);
  const { data: outcomes = [] } = useActivityOutcomes(resolvedPipelineId);
  const { data: contactDeals = [] } = useContactPipelineDeals(allowDealPicker ? contactId ?? undefined : undefined);
  const log = useLogFollowUp();

  const [kind, setKind] = useState("llamada_saliente");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(dealId);
  const [outcomeId, setOutcomeId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [occurred, setOccurred] = useState(() => toLocalInput(new Date()));
  const [hasNext, setHasNext] = useState(true);
  const [nextAt, setNextAt] = useState(defaultNext);
  const [nextTitle, setNextTitle] = useState("");
  const [targetStage, setTargetStage] = useState<string>("none");

  const effectiveDeal = useMemo(
    () => contactDeals.find((d: any) => d.id === selectedDealId) ?? null,
    [contactDeals, selectedDealId],
  );
  const effectiveStageId = effectiveDeal?.stageId ?? stageId ?? null;

  const available = useMemo(
    () => filterOutcomes(outcomes, effectiveStageId, kind),
    [outcomes, effectiveStageId, kind],
  );
  const outcome = available.find((o) => o.id === outcomeId) ?? null;

  useEffect(() => {
    if (!open) return;
    setKind("llamada_saliente");
    setSelectedDealId(dealId);
    setDescription("");
    setOccurred(toLocalInput(new Date()));
    setHasNext(true);
    setNextAt(defaultNext());
    setNextTitle("");
  }, [open, dealId]);

  // Al cambiar tipificación, precargar la etapa sugerida y la exigencia de próxima acción.
  useEffect(() => {
    if (!outcome) { setTargetStage("none"); return; }
    setTargetStage(outcome.movesToStageId ?? "none");
    if (outcome.requiresNextAction) setHasNext(true);
  }, [outcomeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (available.length && !available.some((o) => o.id === outcomeId)) setOutcomeId(available[0].id);
    if (!available.length) setOutcomeId("");
  }, [available, outcomeId]);

  const suggestedStageName = stages.find((s) => s.id === outcome?.movesToStageId)?.name ?? null;
  const currentStageName = stages.find((s) => s.id === effectiveStageId)?.name ?? null;

  async function save() {
    if (!description.trim()) return toast.error("Describe el seguimiento");
    if (!outcome) return toast.error("Selecciona una tipificación");
    if (hasNext && !nextAt) return toast.error("Indica la fecha de la próxima acción");
    try {
      await log.mutateAsync({
        contactId,
        dealId: selectedDealId,
        stageId: effectiveStageId,
        kind,
        outcome,
        description: description.trim(),
        occurredAt: fromLocalInput(occurred),
        nextActionAt: hasNext ? fromLocalInput(nextAt) : null,
        nextActionTitle: nextTitle,
        moveToStageId: targetStage === "none" ? null : targetStage,
      });
      toast.success(
        targetStage !== "none" && targetStage !== effectiveStageId
          ? "Seguimiento registrado y etapa actualizada"
          : "Seguimiento registrado",
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar seguimiento</DialogTitle></DialogHeader>

        <div className="space-y-3">
          {allowDealPicker && contactDeals.length > 0 && (
            <div>
              <Label className="text-xs">Oportunidad</Label>
              <Select value={selectedDealId ?? "none"} onValueChange={(v) => setSelectedDealId(v === "none" ? null : v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin oportunidad</SelectItem>
                  {contactDeals.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo de actividad</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha y hora</Label>
              <Input type="datetime-local" className="h-9" value={occurred} onChange={(e) => setOccurred(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Tipificación (resultado)</Label>
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No hay tipificaciones configuradas para esta etapa. Configúralas en Ajustes → Seguimiento.
              </p>
            ) : (
              <Select value={outcomeId} onValueChange={setOutcomeId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {available.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedDealId && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Etapa</span>
                <WBadge variant="info">{currentStageName ?? "—"}</WBadge>
                {suggestedStageName && suggestedStageName !== currentStageName && (
                  <>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <WBadge variant="success">{suggestedStageName}</WBadge>
                    <span className="text-[11px] text-muted-foreground">sugerido</span>
                  </>
                )}
              </div>
              <Select value={targetStage} onValueChange={setTargetStage}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No mover la etapa</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>Mover a: {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Detalle del seguimiento</Label>
            <Textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué pasó en esta interacción?"
            />
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Programar próxima acción</Label>
              <Switch checked={hasNext} onCheckedChange={setHasNext} />
            </div>
            {hasNext ? (
              <div className="space-y-2">
                <Input type="datetime-local" className="h-9" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
                <Input
                  className="h-9"
                  value={nextTitle}
                  onChange={(e) => setNextTitle(e.target.value)}
                  placeholder={`Seguimiento: ${outcome?.label ?? "próximo contacto"}`}
                  maxLength={200}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin próxima tarea para este contacto.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={log.isPending}>
            {log.isPending ? "Registrando…" : "Registrar seguimiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}