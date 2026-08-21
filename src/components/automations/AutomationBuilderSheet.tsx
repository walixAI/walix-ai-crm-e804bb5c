import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WBadge } from "@/components/walix/Badge";
import { useToast } from "@/hooks/use-toast";
import {
  TRIGGERS, ACTIONS, OPERATORS, CONDITION_FIELDS,
  type TriggerType, type ActionType, type AutomationCondition, type AutomationAction,
} from "@/lib/automations/registry";
import { iconByName, iconForTriggerType } from "@/lib/automations/icons";
import { describeAutomation } from "@/lib/automations/format";
import { useStages } from "@/lib/queries/pipeline";
import { useMessageTemplates } from "@/lib/queries/whatsapp";
import { useCreateAutomation, useUpdateAutomation, type Automation } from "@/lib/queries/automations";
import { ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, FlaskConical, Loader2 } from "lucide-react";
import { AutomationDryRunDialog } from "./AutomationDryRunDialog";
import type { AutomationDraft } from "@/services/automations";

interface DraftState {
  name: string;
  description: string;
  triggerType: TriggerType | "";
  triggerConfig: Record<string, any>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isDraft: boolean;
  enabled: boolean;
}

const EMPTY: DraftState = {
  name: "Mi automatización", description: "",
  triggerType: "", triggerConfig: {}, conditions: [], actions: [],
  isDraft: false, enabled: true,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Si viene, edita; si no, crea. */
  editing?: Automation | null;
  /** Pre-relleno desde plantilla o IA. */
  prefill?: Partial<AutomationDraft> & { isDraft?: boolean; enabled?: boolean } | null;
  /** Si el usuario está en su límite de plan, deshabilita "activar al guardar". */
  forceDraft?: boolean;
}

export function AutomationBuilderSheet({ open, onOpenChange, editing, prefill, forceDraft }: Props) {
  const { toast } = useToast();
  const create = useCreateAutomation();
  const update = useUpdateAutomation();
  const { data: stages = [] } = useStages();
  const { data: templates = [] } = useMessageTemplates();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<DraftState>(EMPTY);
  const [showCondition, setShowCondition] = useState(false);
  const [dryOpen, setDryOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({
        name: editing.name,
        description: editing.description ?? "",
        triggerType: editing.triggerType,
        triggerConfig: editing.triggerConfig,
        conditions: editing.conditions,
        actions: editing.actions,
        isDraft: editing.isDraft,
        enabled: editing.enabled,
      });
      setShowCondition(editing.conditions.length > 0);
    } else if (prefill) {
      setDraft({
        ...EMPTY,
        name: prefill.name ?? EMPTY.name,
        description: prefill.description ?? "",
        triggerType: (prefill.triggerType as TriggerType) ?? "",
        triggerConfig: prefill.triggerConfig ?? {},
        conditions: prefill.conditions ?? [],
        actions: prefill.actions ?? [],
        isDraft: prefill.isDraft ?? false,
        enabled: prefill.enabled ?? !forceDraft,
      });
      setShowCondition((prefill.conditions ?? []).length > 0);
    } else {
      setDraft(EMPTY);
      setShowCondition(false);
    }
    setStep(1);
  }, [open, editing, prefill, forceDraft]);

  const trigger = useMemo(() => TRIGGERS.find((t) => t.type === draft.triggerType), [draft.triggerType]);

  const canNext = useMemo(() => {
    if (step === 1) return draft.name.trim().length > 0;
    if (step === 2) return !!draft.triggerType;
    if (step === 3) return !showCondition || draft.conditions.every((c) => c.field && c.operator && c.value);
    if (step === 4) return draft.actions.length > 0;
    return true;
  }, [step, draft, showCondition]);

  const setTrigger = (type: TriggerType) => {
    const def = TRIGGERS.find((t) => t.type === type)!;
    const config: Record<string, any> = {};
    def.config.forEach((c) => { if (c.default !== undefined) config[c.key] = c.default; });
    setDraft((d) => ({ ...d, triggerType: type, triggerConfig: config }));
  };

  const addCondition = () =>
    setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: "deal.amount", operator: "gt", value: "", logic: d.conditions.length ? "AND" : undefined }] }));
  const updateCondition = (i: number, patch: Partial<AutomationCondition>) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  const removeCondition = (i: number) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, idx) => idx !== i) }));

  const addAction = (type: ActionType) =>
    setDraft((d) => ({ ...d, actions: [...d.actions, { type, config: {} }] }));
  const updateAction = (i: number, patch: Partial<AutomationAction>) =>
    setDraft((d) => ({ ...d, actions: d.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }));
  const removeAction = (i: number) =>
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, idx) => idx !== i) }));

  const save = async (asDraft = false) => {
    if (!draft.triggerType) return;
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      icon: iconForTriggerType(draft.triggerType),
      enabled: asDraft || forceDraft ? false : draft.enabled,
      isDraft: asDraft,
      triggerType: draft.triggerType as TriggerType,
      triggerConfig: draft.triggerConfig,
      conditions: showCondition ? draft.conditions : [],
      actions: draft.actions,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload });
        toast({ title: "Automatización actualizada" });
      } else {
        await create.mutateAsync(payload);
        toast({ title: asDraft ? "Borrador guardado" : "Automatización creada", description: payload.enabled ? "Está activa." : "Quedó pausada." });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const summary = draft.triggerType
    ? describeAutomation(draft.triggerType, draft.triggerConfig, showCondition ? draft.conditions : [], draft.actions)
    : "Configura el disparador para ver el resumen.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl bg-card overflow-y-auto p-0">
        <div className="px-6 pt-6">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar automatización" : "Nueva automatización"}</SheetTitle>
            <SheetDescription>Paso {step} de 5</SheetDescription>
          </SheetHeader>

          {/* Stepper */}
          <div className="mt-4 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Nombre</label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej: Bienvenida a leads nuevos" />
              </div>
              <div>
                <label className="text-xs font-medium">Descripción (opcional)</label>
                <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Para qué sirve esta automatización" rows={3} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Elige cuándo se debe disparar:</p>
              {TRIGGERS.map((t) => {
                const Icon = t.icon;
                const selected = draft.triggerType === t.type;
                return (
                  <button
                    key={t.type}
                    onClick={() => setTrigger(t.type)}
                    className={`w-full text-left rounded-xl border p-3 transition ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${selected ? "bg-primary/15" : "bg-muted"}`}>
                        <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                        {selected && t.config.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {t.config.map((field) => {
                              if (field.kind === "number") {
                                return (
                                  <div key={field.key} className="col-span-2 sm:col-span-1">
                                    <label className="text-[11px] text-muted-foreground">{field.label}</label>
                                    <Input
                                      type="number" min={1}
                                      value={draft.triggerConfig[field.key] ?? ""}
                                      onChange={(e) => setDraft({ ...draft, triggerConfig: { ...draft.triggerConfig, [field.key]: Number(e.target.value) } })}
                                    />
                                  </div>
                                );
                              }
                              if (field.kind === "stage_from" || field.kind === "stage_to") {
                                return (
                                  <div key={field.key} className="col-span-2 sm:col-span-1">
                                    <label className="text-[11px] text-muted-foreground">{field.label}</label>
                                    <Select
                                      value={draft.triggerConfig[field.key] ?? "any"}
                                      onValueChange={(v) => setDraft({ ...draft, triggerConfig: { ...draft.triggerConfig, [field.key]: v } })}
                                    >
                                      <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                                      <SelectContent className="bg-popover">
                                        <SelectItem value="any">Cualquier etapa</SelectItem>
                                        {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Agregar filtro (opcional)</p>
                  <p className="text-xs text-muted-foreground">Solo se ejecutará si se cumple esta condición.</p>
                </div>
                <Switch checked={showCondition} onCheckedChange={setShowCondition} />
              </div>
              {showCondition && (
                <div className="space-y-2">
                  {draft.conditions.map((c, i) => {
                    const f = CONDITION_FIELDS.find((x) => x.value === c.field);
                    return (
                      <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                        {i > 0 && (
                          <Select value={c.logic ?? "AND"} onValueChange={(v) => updateCondition(i, { logic: v as any })}>
                            <SelectTrigger className="w-24 h-7 text-xs bg-card"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="AND">Y</SelectItem>
                              <SelectItem value="OR">O</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Select value={c.field} onValueChange={(v) => updateCondition(i, { field: v })}>
                            <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover">
                              {CONDITION_FIELDS.map((cf) => <SelectItem key={cf.value} value={cf.value}>{cf.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={c.operator} onValueChange={(v) => updateCondition(i, { operator: v as any })}>
                            <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-popover">
                              {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {f?.kind === "select" && f.options ? (
                            <Select value={c.value} onValueChange={(v) => updateCondition(i, { value: v })}>
                              <SelectTrigger className="bg-card"><SelectValue placeholder="Valor" /></SelectTrigger>
                              <SelectContent className="bg-popover">
                                {f.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })}
                              placeholder="Valor" type={f?.kind === "number" ? "number" : "text"}
                            />
                          )}
                        </div>
                        <button onClick={() => removeCondition(i)} className="text-xs text-danger hover:underline">Eliminar</button>
                      </div>
                    );
                  })}
                  {draft.conditions.length < 3 && (
                    <Button variant="outline" size="sm" onClick={addCondition} className="w-full">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar condición
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Elige una o más acciones a ejecutar:</p>
              {draft.actions.map((a, i) => {
                const def = ACTIONS.find((x) => x.type === a.type)!;
                const Icon = def.icon;
                return (
                  <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{def.title}</span>
                      </div>
                      <button onClick={() => removeAction(i)} className="text-muted-foreground hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {a.type === "send_whatsapp" && (
                      <Select value={a.config.templateId ?? ""} onValueChange={(v) => updateAction(i, { config: { ...a.config, templateId: v } })}>
                        <SelectTrigger className="bg-card"><SelectValue placeholder="Elegir plantilla" /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {templates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sin plantillas. Crea una desde WhatsApp.</div>}
                          {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {a.type === "create_task" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Título de la tarea" value={a.config.title ?? ""}
                          onChange={(e) => updateAction(i, { config: { ...a.config, title: e.target.value } })}
                          className="col-span-2"
                        />
                        <div className="col-span-2 sm:col-span-1">
                          <label className="text-[11px] text-muted-foreground">Vence en (días)</label>
                          <Input type="number" min={0} value={a.config.dueInDays ?? 1}
                            onChange={(e) => updateAction(i, { config: { ...a.config, dueInDays: Number(e.target.value) } })} />
                        </div>
                      </div>
                    )}
                    {a.type === "propose_task" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Título de la propuesta" value={a.config.title ?? ""}
                          onChange={(e) => updateAction(i, { config: { ...a.config, title: e.target.value } })}
                          className="col-span-2"
                        />
                        <Input
                          placeholder="Detalle (por qué se propone)" value={a.config.subtitle ?? ""}
                          onChange={(e) => updateAction(i, { config: { ...a.config, subtitle: e.target.value } })}
                          className="col-span-2"
                        />
                        <div className="col-span-2 sm:col-span-1">
                          <label className="text-[11px] text-muted-foreground">Vigencia (días)</label>
                          <Input type="number" min={1} value={a.config.expires_days ?? 7}
                            onChange={(e) => updateAction(i, { config: { ...a.config, expires_days: Number(e.target.value) } })} />
                        </div>
                        <p className="col-span-2 text-[11px] text-muted-foreground">
                          No crea la tarea: aparece como propuesta en Mi Día y Tareas para aceptar o rechazar.
                        </p>
                      </div>
                    )}
                    {a.type === "notify_owner" && (
                      <Select value={a.config.channel ?? "in_app"} onValueChange={(v) => updateAction(i, { config: { ...a.config, channel: v } })}>
                        <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="in_app">Solo en la app</SelectItem>
                          <SelectItem value="in_app_email">App + correo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {a.type === "reassign_contact" && (
                      <Select value={a.config.strategy ?? "round_robin"} onValueChange={(v) => updateAction(i, { config: { ...a.config, strategy: v } })}>
                        <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="round_robin">Round-robin (vendedor con menos carga)</SelectItem>
                          <SelectItem value="manual">Vendedor específico</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {a.type === "add_tag" && (
                      <Input placeholder="Nombre de la etiqueta" value={a.config.tag ?? ""}
                        onChange={(e) => updateAction(i, { config: { ...a.config, tag: e.target.value } })} />
                    )}
                    {a.type === "move_deal_stage" && (
                      <Select value={a.config.stageId ?? ""} onValueChange={(v) => updateAction(i, { config: { ...a.config, stageId: v } })}>
                        <SelectTrigger className="bg-card"><SelectValue placeholder="Etapa destino" /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACTIONS.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button key={act.type} onClick={() => addAction(act.type)}
                      className="text-left rounded-lg border border-dashed border-border bg-card p-3 hover:border-primary/40 transition">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium">{act.title}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-gradient-brand/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-primary">Así se vería</span>
                </div>
                <p className="text-sm leading-relaxed">{summary}</p>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setDryOpen(true)} disabled={!draft.triggerType}>
                <FlaskConical className="h-4 w-4 mr-2" /> Probar con datos reales
              </Button>

              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium">Activar al guardar</p>
                  <p className="text-xs text-muted-foreground">
                    {forceDraft ? "Llegaste al límite de tu plan, se guardará pausada." : "Empezará a ejecutarse de inmediato."}
                  </p>
                </div>
                <Switch checked={!forceDraft && draft.enabled} disabled={forceDraft} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-3 flex items-center justify-between gap-2">
          <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <div className="flex items-center gap-2">
            {!editing && step >= 2 && (
              <Button variant="outline" size="sm" onClick={() => save(true)} disabled={create.isPending || update.isPending}>
                Guardar borrador
              </Button>
            )}
            {step < 5 ? (
              <Button onClick={() => setStep((s) => Math.min(5, s + 1))} disabled={!canNext}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => save(false)} disabled={create.isPending || update.isPending}>
                {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Guardar cambios" : "Guardar y activar"}
              </Button>
            )}
          </div>
        </div>

        {draft.triggerType && (
          <AutomationDryRunDialog
            open={dryOpen} onOpenChange={setDryOpen}
            triggerType={draft.triggerType as TriggerType}
            triggerConfig={draft.triggerConfig}
            conditions={showCondition ? draft.conditions : []}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}