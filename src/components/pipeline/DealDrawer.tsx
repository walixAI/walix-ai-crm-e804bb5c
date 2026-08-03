import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Bot, ChevronRight, Lock, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WBadge } from "@/components/walix/Badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  formatMXN, useDealActivity, useDealAiSuggestions, useUpdateDeal, useStageHistory,
  type PipelineDeal, type PipelineStage,
} from "@/lib/queries/pipeline";
import { useScoreProbability, useSuggestNextStep, type NextStepSuggestion, type ProbabilityScore } from "@/lib/queries/pipelineAi";
import { relativeTime } from "@/lib/format/relativeTime";
import { cn } from "@/lib/utils";
import { AiContextPanel } from "@/components/walix/AiContextPanel";
import { LogFollowUpDialog } from "@/components/activity/LogFollowUpDialog";
import { DealDiagnosticPanel } from "./DealDiagnosticPanel";
import {
  useDealNotes, useCreateDealNote, useUpdateDealNote, useDeleteDealNote,
} from "@/lib/queries/dealNotes";

const sources = ["WhatsApp", "Formulario web", "Referido", "Manual"];

interface Props {
  deal: PipelineDeal | null;
  stages: PipelineStage[];
  open: boolean;
  onClose: () => void;
  contactName?: string;
  contactLastActivityAt?: string | null;
  defaultTab?: "summary" | "activity" | "history" | "ai";
}

export function DealDrawer({ deal, stages, open, onClose, contactName, contactLastActivityAt, defaultTab = "summary" }: Props) {
  const update = useUpdateDeal();
  const suggestNextStep = useSuggestNextStep();
  const scoreProbability = useScoreProbability();
  const [aiSuggestion, setAiSuggestion] = useState<NextStepSuggestion | null>(null);
  const [aiScore, setAiScore] = useState<ProbabilityScore | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (deal) {
      setAiSuggestion(null);
      setAiScore(null);
    }
  }, [deal]);

  const { data: activity = [] } = useDealActivity(deal?.id);
  const { data: aiSuggestions = [] } = useDealAiSuggestions(deal?.id, deal?.contactId);
  const { data: stageHistory = [] } = useStageHistory(deal?.id);
  const { data: notes = [] } = useDealNotes(deal?.id);
  const createNote = useCreateDealNote(deal?.id, deal?.contactId ?? null);
  const updateNote = useUpdateDealNote(deal?.id);
  const deleteNote = useDeleteDealNote(deal?.id);

  const lastStageChangeAt = stageHistory[0]?.changedAt ?? deal?.updatedAt ?? null;
  const daysInStage = lastStageChangeAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastStageChangeAt).getTime()) / 86_400_000))
    : 0;

  if (!deal) return null;

  async function savePatch(patch: Record<string, any>) {
    if (!deal) return;
    try {
      await update.mutateAsync({ dealId: deal.id, patch });
      toast.success("Cambio guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
      throw e;
    }
  }

  // Heuristic explanation for AI tab
  const explanation =
    deal.probability >= 70
      ? "Alta probabilidad: monto elevado, cliente activo y avance constante en el pipeline."
      : deal.probability >= 40
        ? "Probabilidad media: hay interés pero faltan señales claras de cierre."
        : "Probabilidad baja: poca actividad reciente. Reactiva al contacto.";

  async function runSuggestNextStep() {
    if (!deal) return;
    try {
      const r = await suggestNextStep.mutateAsync({ deal, lastActivityAt: contactLastActivityAt });
      setAiSuggestion(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al sugerir siguiente paso");
    }
  }

  async function runScoreProbability() {
    if (!deal) return;
    try {
      const r = await scoreProbability.mutateAsync({ deal, lastActivityAt: contactLastActivityAt });
      setAiScore(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al calcular probabilidad");
    }
  }

  async function applyAiProbability() {
    if (!deal || !aiScore) return;
    try {
      await update.mutateAsync({ dealId: deal.id, patch: { probability: aiScore.probability } });
      toast.success(`Probabilidad actualizada a ${aiScore.probability}%`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="truncate pr-8">{deal.name}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-success font-bold text-lg">{formatMXN(deal.amount)} MXN</span>
            <WBadge variant={deal.isWon ? "success" : deal.isLost ? "danger" : "info"}>{deal.stageName}</WBadge>
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            {contactName && (
              deal.contactId ? (
                <Link
                  to={`/contacts/${deal.contactId}`}
                  onClick={onClose}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Contacto: {contactName} <ChevronRight className="h-3 w-3" />
                </Link>
              ) : (
                <span>Contacto: {contactName}</span>
              )
            )}
            <span>Creada el {format(new Date(deal.createdAt), "PPP", { locale: es })}</span>
          </div>
        </SheetHeader>

        <Tabs key={`${deal.id}-${defaultTab}`} defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 grid grid-cols-4">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="ai">IA</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="summary" className="space-y-4 m-0">
              <EditableField
                label="Monto MXN"
                display={formatMXN(deal.amount)}
                value={String(deal.amount)}
                onSave={(v) => savePatch({ amount: Number(v) || 0 })}
                render={(v, set) => <Input type="number" autoFocus value={v} onChange={(e) => set(e.target.value)} />}
              />

              <Field label="Etapa">
                <ReadValue>{deal.stageName}</ReadValue>
                <p className="text-[11px] text-muted-foreground">
                  La etapa cambia al registrar un seguimiento (pestaña Actividad).
                </p>
              </Field>

              <EditableField
                label="Fecha estimada de cierre"
                display={deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), "PPP", { locale: es }) : "—"}
                value={deal.expectedCloseDate ?? ""}
                onSave={(v) => savePatch({ expected_close_date: v || null })}
                render={(v, set) => <Input type="date" autoFocus value={v} onChange={(e) => set(e.target.value)} />}
              />

              <EditableField
                label={`Probabilidad: ${deal.probability}%`}
                value={String(deal.probability)}
                onSave={(v) => savePatch({ probability: Number(v) })}
                display={
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full", deal.probability >= 70 ? "bg-success" : deal.probability >= 40 ? "bg-warning" : "bg-danger")}
                      style={{ width: `${deal.probability}%` }}
                    />
                  </div>
                }
                render={(v, set) => (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{v}%</div>
                    <Slider value={[Number(v)]} onValueChange={([n]) => set(String(n))} min={0} max={100} step={5} />
                  </div>
                )}
              />

              <EditableField
                label="Fuente"
                display={deal.source}
                value={deal.source ?? ""}
                onSave={(v) => savePatch({ source: v })}
                render={(v, set) => (
                  <Select value={v} onValueChange={set}>
                    <SelectTrigger><SelectValue placeholder="Elige una fuente" /></SelectTrigger>
                    <SelectContent>
                      {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />

              <DealDiagnosticPanel deal={deal} />

              <EditableField
                label="Descripción general"
                display={deal.notes ?? "—"}
                value={deal.notes ?? ""}
                onSave={(v) => savePatch({ notes: v || null })}
                render={(v, set) => <Textarea rows={3} autoFocus value={v} onChange={(e) => set(e.target.value)} />}
              />

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Notas</div>
                <div className="flex gap-2 items-start">
                  <Textarea
                    rows={2}
                    maxLength={2000}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Escribe una nota…"
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    disabled={!newNote.trim() || createNote.isPending}
                    onClick={async () => {
                      try {
                        await createNote.mutateAsync(newNote.trim());
                        setNewNote("");
                        toast.success("Nota agregada");
                      } catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {notes.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sin notas todavía.</p>
                )}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border bg-card p-3">
                    {editingNote?.id === n.id ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={3}
                          value={editingNote.text}
                          onChange={(e) => setEditingNote({ id: n.id, text: e.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>Cancelar</Button>
                          <Button
                            size="sm"
                            disabled={updateNote.isPending || !editingNote.text.trim()}
                            onClick={async () => {
                              try {
                                await updateNote.mutateAsync({ id: n.id, description: editingNote.text.trim() });
                                setEditingNote(null);
                                toast.success("Nota actualizada");
                              } catch (e: any) { toast.error(e?.message ?? "Error"); }
                            }}
                          >Guardar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm whitespace-pre-wrap break-words">{n.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-muted-foreground flex-1">
                            {format(new Date(n.occurredAt), "PPP HH:mm", { locale: es })}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => setEditingNote({ id: n.id, text: n.description })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-danger"
                            onClick={async () => {
                              try { await deleteNote.mutateAsync(n.id); toast.success("Nota eliminada"); }
                              catch (e: any) { toast.error(e?.message ?? "Error"); }
                            }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="m-0">
              <Button size="sm" className="w-full mb-4" onClick={() => setFollowUpOpen(true)}>
                <Plus className="h-4 w-4" /> Registrar seguimiento
              </Button>
              <div className="relative pl-2">
                <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                {activity.length === 0 && (
                  <div className="text-sm text-muted-foreground italic py-6 text-center">
                    Sin actividad registrada todavía.
                  </div>
                )}
                {activity.map((a: any) => (
                  <div key={a.id} className="relative flex gap-4 pb-4">
                    <div className="relative z-10 h-9 w-9 rounded-full bg-primary/10 grid place-items-center shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 pt-1.5">
                      <div className="text-sm">{a.description}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.metadata?.activity_kind_label && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {a.metadata.activity_kind_label}
                          </span>
                        )}
                        {a.metadata?.result && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {a.metadata.result}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(a.occurred_at), "PPP HH:mm", { locale: es })} · {relativeTime(a.occurred_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3 m-0">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Fecha de creación
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(deal.createdAt), "PPP HH:mm", { locale: es })}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Tiempo en etapa actual
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{daysInStage}</span>
                  <span className="text-sm text-muted-foreground">{daysInStage === 1 ? "día" : "días"} en "{deal.stageName}"</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Cambios de etapa
                </div>
                {stageHistory.length === 0 && (
                  <div className="text-sm text-muted-foreground italic py-4 text-center">
                    Sin historial de cambios.
                  </div>
                )}
                {stageHistory.map((h) => (
                  <div key={h.id} className="rounded-md border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      {h.metadata?.automatic && (
                        <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                      <span className="text-muted-foreground">{h.fromStageName ?? "Inicio"}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium flex-1 truncate">{h.toStageName ?? "—"}</span>
                      {h.metadata?.automatic && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          Auto
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(h.changedAt), "PPP HH:mm", { locale: es })} · {relativeTime(h.changedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 m-0">
              <AiContextPanel entityType="deal" entityId={deal.id} />
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide flex-1">Siguiente paso</span>
                  {aiSuggestion && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={runSuggestNextStep} disabled={suggestNextStep.isPending}>
                      <RefreshCw className={cn("h-3 w-3", suggestNextStep.isPending && "animate-spin")} />
                    </Button>
                  )}
                </div>
                {aiSuggestion ? (
                  <>
                    <p className="text-sm leading-relaxed font-medium">{aiSuggestion.next_step}</p>
                    <p className="text-xs text-muted-foreground mt-2 italic">{aiSuggestion.reasoning}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <WBadge variant={aiSuggestion.urgency === "high" ? "danger" : aiSuggestion.urgency === "medium" ? "warning" : "info"}>
                        Urgencia: {aiSuggestion.urgency}
                      </WBadge>
                    </div>
                  </>
                ) : suggestNextStep.isPending ? (
                  <div className="text-sm text-muted-foreground animate-pulse">Pensando…</div>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {aiSuggestions[0]?.text ?? "Genera una recomendación de IA basada en el contexto actual del deal."}
                    </p>
                    <Button size="sm" className="mt-3 bg-primary hover:bg-primary/90 h-8" onClick={runSuggestNextStep}>
                      <Sparkles className="h-3 w-3" /> Sugerir siguiente paso
                    </Button>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Probabilidad de cierre
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={runScoreProbability} disabled={scoreProbability.isPending}>
                    <Zap className={cn("h-3 w-3", scoreProbability.isPending && "animate-pulse")} /> Auto-calcular
                  </Button>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl font-bold">{deal.probability}%</span>
                  <WBadge variant={deal.probability >= 70 ? "success" : deal.probability >= 40 ? "warning" : "danger"}>
                    {deal.probability >= 70 ? "Alta" : deal.probability >= 40 ? "Media" : "Baja"}
                  </WBadge>
                </div>
                {aiScore ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">IA sugiere:</span>
                      <span className={cn(
                        "text-lg font-bold",
                        aiScore.probability >= 70 ? "text-success"
                          : aiScore.probability >= 40 ? "text-warning" : "text-danger",
                      )}>{aiScore.probability}%</span>
                      {aiScore.probability !== deal.probability && (
                        <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={applyAiProbability} disabled={update.isPending}>
                          Aplicar
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiScore.reasoning}</p>
                    {aiScore.signals.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                        {aiScore.signals.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>
                )}
              </div>

              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Generar propuesta PDF
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Disponible en plan Pro</div>
                  </div>
                  <WBadge variant="brand">Pro</WBadge>
                </div>
                <Button disabled className="w-full mt-3" variant="outline" size="sm">
                  Bloqueado en Starter
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>

      <LogFollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        contactId={deal.contactId}
        dealId={deal.id}
        stageId={deal.stageId}
        pipelineId={stages[0]?.pipelineId ?? null}
      />
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReadValue({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium px-3 py-2 rounded-md bg-muted/40">{children}</div>;
}

/** Campo editable en línea: clic en "Editar" para modificar y guardar el cambio al instante. */
function EditableField({
  label, display, value, onSave, render,
}: {
  label: string;
  display: React.ReactNode;
  value: string;
  onSave: (v: string) => Promise<void> | void;
  render: (v: string, set: (v: string) => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {!editing && (
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(true); }}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {render(draft, setDraft)}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(value); }}>Cancelar</Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try { await onSave(draft); setEditing(false); } catch { /* toast en el caller */ }
                finally { setSaving(false); }
              }}
            >
              <Save className="h-3.5 w-3.5" /> Guardar
            </Button>
          </div>
        </div>
      ) : (
        typeof display === "string" ? <ReadValue>{display}</ReadValue> : display
      )}
    </div>
  );
}

// Helper avatar for contact (kept here in case we want to display it later)
export function ContactAvatar({ name, color }: { name: string; color: string }) {
  return (
    <Avatar className="h-5 w-5">
      <AvatarFallback className="text-[9px] text-white" style={{ backgroundColor: color }}>
        {name.split(" ").map(p => p[0]).slice(0, 2).join("")}
      </AvatarFallback>
    </Avatar>
  );
}
