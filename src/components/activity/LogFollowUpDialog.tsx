import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CircleSlash, PauseCircle, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WBadge } from "@/components/walix/Badge";
import { cn } from "@/lib/utils";
import { toLocalInput, fromLocalInput } from "@/lib/format/localDatetime";
import { usePipelines, useStages, useContactPipelineDeals } from "@/lib/queries/pipeline";
import {
  ACTIVITY_KINDS, filterOutcomes, useActivityOutcomes, useLogFollowUp,
} from "@/lib/queries/activityOutcomes";
import {
  useDealBlockers, useDealLossReasons, useDealDiagnostic, daysSince,
} from "@/lib/queries/dealDiagnostics";

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

/** Fecha (YYYY-MM-DD) a N días de hoy. */
function dateInput(daysAhead: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** Convierte YYYY-MM-DD a ISO a las 10:00 locales. */
function dayToIso(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 10, 0, 0, 0).toISOString();
}

function longDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });
}

const DAY_PRESETS = [
  { label: "Mañana", days: 1 },
  { label: "En 3 días", days: 3 },
  { label: "En 1 semana", days: 7 },
  { label: "En 15 días", days: 15 },
];

/** Botón grande de opción, pensado para lectura fácil. */
function BigChoice({
  active, onClick, children, className,
}: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-muted",
        className,
      )}
    >
      {active && <Check className="h-4 w-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Modo de diagnóstico elegido por el usuario. */
type DiagMode = "none" | "blocked" | "lost";

export function LogFollowUpDialog({
  open, onOpenChange, contactId, dealId = null, stageId = null, pipelineId = null, allowDealPicker = false,
}: Props) {
  const { data: pipelines = [] } = usePipelines();
  const resolvedPipelineId = pipelineId ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
  const { data: stages = [] } = useStages(resolvedPipelineId);
  const { data: outcomes = [] } = useActivityOutcomes(resolvedPipelineId);
  const { data: contactDeals = [] } = useContactPipelineDeals(allowDealPicker ? contactId ?? undefined : undefined);
  const log = useLogFollowUp();
  const { data: blockers = [] } = useDealBlockers();
  const { data: lossReasons = [] } = useDealLossReasons();

  const [kind, setKind] = useState("llamada_saliente");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(dealId);
  const [outcomeId, setOutcomeId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [occurred, setOccurred] = useState(() => toLocalInput(new Date()));
  const [hasNext, setHasNext] = useState(true);
  const [nextDay, setNextDay] = useState(() => dateInput(2));
  const [customNextDay, setCustomNextDay] = useState(false);
  const [targetStage, setTargetStage] = useState<string>("none");
  const [showStage, setShowStage] = useState(false);
  const [diagMode, setDiagMode] = useState<DiagMode>("none");
  const [blockerId, setBlockerId] = useState<string>("");
  const [blockerExpected, setBlockerExpected] = useState<string>(() => dateInput(7));
  const [lossReasonId, setLossReasonId] = useState<string>("");
  const [clearBlocker, setClearBlocker] = useState(false);

  const effectiveDeal = useMemo(
    () => contactDeals.find((d: any) => d.id === selectedDealId) ?? null,
    [contactDeals, selectedDealId],
  );
  const effectiveStageId = effectiveDeal?.stageId ?? stageId ?? null;

  const { data: diagnostic } = useDealDiagnostic(selectedDealId);
  const activeBlockers = useMemo(() => blockers.filter((b) => b.isActive), [blockers]);
  const activeLossReasons = useMemo(() => lossReasons.filter((r) => r.isActive), [lossReasons]);
  const currentBlocker = activeBlockers.find((b) => b.id === diagnostic?.currentBlockerId) ?? null;
  const blockerAge = daysSince(diagnostic?.blockerSetAt);

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
    setEditOccurred(false);
    setHasNext(true);
    setNextDay(dateInput(2));
    setCustomNextDay(false);
    setShowStage(false);
    setDiagMode("none");
    setBlockerId("");
    setLossReasonId("");
    setClearBlocker(false);
    setBlockerExpected(dateInput(7));
  }, [open, dealId]);

  // Al elegir un bloqueo, precargar su fecha esperada de resolución.
  useEffect(() => {
    const b = activeBlockers.find((x) => x.id === blockerId);
    if (b) setBlockerExpected(dateInput(b.defaultResolutionDays));
  }, [blockerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar tipificación, precargar la etapa sugerida y la exigencia de próxima acción.
  useEffect(() => {
    if (!outcome) { setTargetStage("none"); return; }
    setTargetStage(outcome.movesToStageId ?? "none");
    if (outcome.movesToStageId) setShowStage(true);
    if (outcome.requiresNextAction) setHasNext(true);
  }, [outcomeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (available.length && !available.some((o) => o.id === outcomeId)) setOutcomeId(available[0].id);
    if (!available.length) setOutcomeId("");
  }, [available, outcomeId]);

  const suggestedStageName = stages.find((s) => s.id === outcome?.movesToStageId)?.name ?? null;
  const currentStageName = stages.find((s) => s.id === effectiveStageId)?.name ?? null;
  const targetStageName = stages.find((s) => s.id === targetStage)?.name ?? null;

  async function save() {
    if (!description.trim()) return toast.error("Escribe qué pasó en el contacto");
    if (!outcome) return toast.error("Selecciona el resultado");
    if (hasNext && !nextDay) return toast.error("Indica cuándo vuelves a contactar");
    if (diagMode === "blocked" && !blockerId) return toast.error("Indica qué está esperando el cliente");
    if (diagMode === "lost" && !lossReasonId) return toast.error("Selecciona por qué se perdió");
    try {
      await log.mutateAsync({
        contactId,
        dealId: selectedDealId,
        stageId: effectiveStageId,
        kind,
        outcome,
        description: description.trim(),
        occurredAt: fromLocalInput(occurred),
        nextActionAt: hasNext ? dayToIso(nextDay) : null,
        nextActionTitle: hasNext ? `Seguimiento: ${outcome.label}` : "",
        moveToStageId: targetStage === "none" ? null : targetStage,
        blockerId: diagMode === "blocked" ? blockerId : null,
        blockerLabel: diagMode === "blocked"
          ? activeBlockers.find((b) => b.id === blockerId)?.label ?? null
          : null,
        blockerExpectedAt: diagMode === "blocked" ? blockerExpected || null : null,
        blockerNote: null,
        clearBlocker: clearBlocker || diagMode === "lost",
        lossReasonId: diagMode === "lost" ? lossReasonId : null,
        lossReasonLabel: diagMode === "lost"
          ? activeLossReasons.find((r) => r.id === lossReasonId)?.label ?? null
          : null,
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
        <DialogHeader>
          <DialogTitle className="text-xl">Registrar seguimiento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {allowDealPicker && contactDeals.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-base">Oportunidad</Label>
              <Select value={selectedDealId ?? "none"} onValueChange={(v) => setSelectedDealId(v === "none" ? null : v)}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin oportunidad</SelectItem>
                  {contactDeals.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 1. ¿Cómo lo contactaste? */}
          <div className="space-y-1.5">
            <Label className="text-base">1. ¿Cómo lo contactaste?</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value} className="text-base">{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. ¿Qué pasó? */}
          <div className="space-y-1.5">
            <Label className="text-base">2. ¿Qué pasó?</Label>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hay resultados configurados para esta etapa. Configúralos en Ajustes → Seguimiento.
              </p>
            ) : (
              <Select value={outcomeId} onValueChange={setOutcomeId}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {available.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-base">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Textarea
              rows={3}
              maxLength={2000}
              className="text-base"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Escribe con tus palabras qué te dijo el cliente…"
            />
          </div>

          {/* 3. ¿Cuándo le vuelves a hablar? */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">3. ¿Cuándo le vuelves a hablar?</Label>
              <Switch checked={hasNext} onCheckedChange={setHasNext} />
            </div>
            {hasNext ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_PRESETS.map((p) => {
                    const day = dateInput(p.days);
                    return (
                      <BigChoice
                        key={p.label}
                        active={!customNextDay && nextDay === day}
                        onClick={() => { setCustomNextDay(false); setNextDay(day); }}
                      >
                        {p.label}
                      </BigChoice>
                    );
                  })}
                  <BigChoice
                    active={customNextDay}
                    onClick={() => setCustomNextDay(true)}
                    className="col-span-2"
                  >
                    Otro día
                  </BigChoice>
                </div>
                {customNextDay && (
                  <Input
                    type="date"
                    className="h-12 text-base"
                    value={nextDay}
                    onChange={(e) => setNextDay(e.target.value)}
                  />
                )}
                {nextDay && (
                  <p className="text-sm text-muted-foreground">
                    Te lo recordaremos el <span className="font-medium text-foreground">{longDate(nextDay)}</span> a las 10:00.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sin recordatorio para este contacto.</p>
            )}
          </div>

          {/* 4. Diagnóstico */}
          {selectedDealId && (
            <div className="space-y-3">
              <Label className="text-base">4. ¿Por qué no avanza?</Label>

              {currentBlocker && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                  <PauseCircle className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium">{currentBlocker.label}</span>
                  {blockerAge !== null && (
                    <span className="text-sm text-muted-foreground">hace {blockerAge} días</span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-muted-foreground">Ya se resolvió</span>
                    <Switch checked={clearBlocker} onCheckedChange={setClearBlocker} />
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <BigChoice active={diagMode === "none"} onClick={() => setDiagMode("none")}>
                  Todo bien, sigue avanzando
                </BigChoice>
                <BigChoice active={diagMode === "blocked"} onClick={() => setDiagMode("blocked")}>
                  Está esperando algo
                </BigChoice>
                <BigChoice active={diagMode === "lost"} onClick={() => setDiagMode("lost")}>
                  Ya no quiere / se perdió
                </BigChoice>
              </div>

              {diagMode === "blocked" && (
                <div className="space-y-2">
                  {activeBlockers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay bloqueos configurados. Agrégalos en Ajustes → Seguimiento.
                    </p>
                  ) : (
                    <>
                      <Label className="text-sm text-muted-foreground">¿Qué está esperando?</Label>
                      <Select value={blockerId} onValueChange={setBlockerId}>
                        <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                        <SelectContent>
                          {activeBlockers.map((b) => (
                            <SelectItem key={b.id} value={b.id} className="text-base">{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {blockerId && (
                        <p className="text-sm text-muted-foreground">
                          Esperamos respuesta cerca del{" "}
                          <span className="font-medium text-foreground">{longDate(blockerExpected)}</span>.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {diagMode === "lost" && (
                <div className="space-y-2">
                  {activeLossReasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay motivos configurados. Agrégalos en Ajustes → Seguimiento.
                    </p>
                  ) : (
                    <>
                      <Label className="text-sm text-muted-foreground flex items-center gap-1">
                        <CircleSlash className="h-4 w-4 text-danger" /> ¿Por qué se perdió?
                      </Label>
                      <Select value={lossReasonId} onValueChange={setLossReasonId}>
                        <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                        <SelectContent>
                          {activeLossReasons.map((r) => (
                            <SelectItem key={r.id} value={r.id} className="text-base">{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <p className="text-sm text-muted-foreground">
                    La oportunidad se marcará como perdida.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Etapa: sólo si hay sugerencia o el usuario lo pide */}
          {selectedDealId && (
            showStage ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Etapa</span>
                  <WBadge variant="info">{currentStageName ?? "—"}</WBadge>
                  {targetStageName && targetStageName !== currentStageName && (
                    <>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <WBadge variant="success">{targetStageName}</WBadge>
                      {suggestedStageName === targetStageName && (
                        <span className="text-sm text-muted-foreground">sugerido</span>
                      )}
                    </>
                  )}
                </div>
                <Select value={targetStage} onValueChange={setTargetStage}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-base">No mover la etapa</SelectItem>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-base">Mover a: {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-2"
                onClick={() => setShowStage(true)}
              >
                Cambiar la etapa de la oportunidad
              </button>
            )
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="lg" className="text-base" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="lg" className="text-base" onClick={save} disabled={log.isPending}>
            {log.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
