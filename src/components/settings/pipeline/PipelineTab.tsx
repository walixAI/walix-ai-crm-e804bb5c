import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Save, ChevronDown, ChevronRight, Zap, Trash2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/services/audit";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableStage, type StageDraft } from "./SortableStage";
import { DeleteStageDialog } from "./DeleteStageDialog";
import { useCopyStageOutcomes } from "@/lib/queries/pipelineStages";
import {
  usePipelineStageRules, useCreatePipelineStageRule, useDeletePipelineStageRule,
  useSeedPipelineTemplate, type PipelineStageRule,
} from "@/lib/queries/pipeline";

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  position: number;
}

const EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "message_received", label: "Mensaje recibido" },
  { value: "payment_received", label: "Pago recibido" },
  { value: "activity_completed", label: "Actividad registrada" },
  { value: "task_completed", label: "Tarea completada" },
];

const TEMPLATE_OPTIONS: { value: string; label: string }[] = [
  { value: "ventas", label: "Ventas" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "refacciones", label: "Refacciones" },
  { value: "renovaciones", label: "Renovaciones" },
];

export function PipelineSettingsTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: pipelines = [], isLoading } = useQuery<Pipeline[]>({
    queryKey: ["settings-pipelines", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, is_default, position")
        .eq("tenant_id", tenantId)
        .order("position");
      if (error) throw error;
      return data as Pipeline[];
    },
  });

  async function handleCreate() {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("pipelines")
        .insert({ tenant_id: tenantId, name: "Nuevo pipeline", position: pipelines.length })
        .select()
        .maybeSingle();
      if (error) throw error;
      await logAudit({ action: "pipeline.created", tenantId, targetType: "pipeline", targetId: data?.id });
      qc.invalidateQueries({ queryKey: ["settings-pipelines", tenantId] });
      toast({ title: "Pipeline creado" });
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: m, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Pipelines</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Crea pipelines, reordena etapas y configura reglas de avance automático.
            </p>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Nuevo pipeline
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Cargando...</Card>
      ) : pipelines.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aún no hay pipelines. Crea el primero arriba.
        </Card>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <PipelineCard
              key={p.id}
              pipeline={p}
              tenantId={tenantId}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineCard({
  pipeline, tenantId, expanded, onToggle,
}: { pipeline: Pipeline; tenantId: string; expanded: boolean; onToggle: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [aiScoring, setAiScoring] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [stageToDelete, setStageToDelete] = useState<StageDraft | null>(null);
  const [newStageIds, setNewStageIds] = useState<string[]>([]);
  const [copyFromId, setCopyFromId] = useState<string>("");
  const copyOutcomes = useCopyStageOutcomes();

  const { data: rules = [] } = usePipelineStageRules(pipeline.id);
  const createRule = useCreatePipelineStageRule();
  const deleteRule = useDeletePipelineStageRule();
  const seedTemplate = useSeedPipelineTemplate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: stagesData } = useQuery({
    queryKey: ["settings-stages", pipeline.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, color, is_won, is_lost, position")
        .eq("pipeline_id", pipeline.id)
        .order("position");
      if (error) throw error;
      return data as (StageDraft & { position: number })[];
    },
  });

  useEffect(() => {
    if (stagesData) setStages(stagesData.map(({ position: _p, ...s }) => s));
  }, [stagesData]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setStages((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function handleAddStage() {
    const newStage: StageDraft = {
      id: `tmp-${Date.now()}`,
      name: "Nueva etapa",
      color: "hsl(220 13% 65%)",
      is_won: false,
      is_lost: false,
    };
    setStages((p) => [...p, newStage]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const createdIds: string[] = [];
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        if (s.id.startsWith("tmp-")) {
          const { data: created } = await supabase.from("pipeline_stages").insert({
            tenant_id: tenantId, pipeline_id: pipeline.id,
            name: s.name, color: s.color, position: i,
            is_won: s.is_won, is_lost: s.is_lost,
          }).select("id").maybeSingle();
          if (created?.id) createdIds.push(created.id);
        } else {
          await supabase.from("pipeline_stages").update({
            name: s.name, color: s.color, position: i,
          }).eq("id", s.id);
        }
      }
      setNewStageIds(createdIds);
      await logAudit({
        action: "pipeline.stages.updated",
        tenantId,
        targetType: "pipeline",
        targetId: pipeline.id,
        metadata: { stageCount: stages.length },
      });
      qc.invalidateQueries({ queryKey: ["settings-stages", pipeline.id] });
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      toast({ title: "Etapas guardadas" });
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: m, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSeedTemplate() {
    if (!selectedTemplate) return;
    try {
      await seedTemplate.mutateAsync({ tenantId, pipelineId: pipeline.id, template: selectedTemplate });
      toast({ title: "Plantilla aplicada", description: "Se crearon etapas y reglas de ejemplo." });
      qc.invalidateQueries({ queryKey: ["settings-stages", pipeline.id] });
      qc.invalidateQueries({ queryKey: ["pipeline-stage-rules", pipeline.id] });
      setSelectedTemplate("");
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: m, variant: "destructive" });
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-medium flex-1 text-left">{pipeline.name}</span>
        {pipeline.is_default && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">Default</span>}
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-5 space-y-4 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm font-medium">Etapas</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={aiScoring} onCheckedChange={setAiScoring} />
                IA scoring activo
              </label>
              <div className="flex items-center gap-2">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-8 text-xs w-[160px]">
                    <SelectValue placeholder="Plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSeedTemplate}
                  disabled={!selectedTemplate || seedTemplate.isPending}
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Aplicar
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddStage}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Etapa
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {stages.map((s) => (
                  <div key={s.id} className="space-y-2">
                    <SortableStage
                      stage={s}
                      rules={rules}
                      expanded={expandedStageId === s.id}
                      onToggleExpand={() => setExpandedStageId(expandedStageId === s.id ? null : s.id)}
                      canDelete={!s.is_won && !s.is_lost}
                      onChange={(patch) =>
                        setStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))
                      }
                      onDelete={() => setStages((prev) => prev.filter((x) => x.id !== s.id))}
                    />
                    {expandedStageId === s.id && (
                      <StageRulesPanel
                        stage={s}
                        stages={stages}
                        rules={rules}
                        tenantId={tenantId}
                        pipelineId={pipeline.id}
                      />
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar etapas
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StageRulesPanel({
  stage, stages, rules, tenantId, pipelineId,
}: {
  stage: StageDraft;
  stages: StageDraft[];
  rules: PipelineStageRule[];
  tenantId: string;
  pipelineId: string;
}) {
  const { toast } = useToast();
  const createRule = useCreatePipelineStageRule();
  const deleteRule = useDeletePipelineStageRule();
  const [event, setEvent] = useState<string>("");
  const [toStageId, setToStageId] = useState<string>("");
  const [activityType, setActivityType] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");

  const stageRules = rules.filter(r => r.fromStageId === stage.id);

  async function addRule() {
    if (!event || !toStageId) {
      toast({ title: "Selecciona evento y etapa destino", variant: "destructive" });
      return;
    }
    const filters: Record<string, any> = {};
    if (event === "activity_completed" && activityType) filters.activity_type = activityType;
    if (event === "activity_completed" && outcome) filters.outcome = outcome;
    if (event === "task_completed" && activityType) filters.task_kind = activityType;
    if (event === "task_completed" && outcome) filters.closed_via = outcome;

    try {
      await createRule.mutateAsync({
        tenantId,
        pipelineId,
        fromStageId: stage.id,
        toStageId,
        triggerEvent: event as any,
        triggerFilters: filters,
      });
      toast({ title: "Regla creada" });
      setEvent("");
      setToStageId("");
      setActivityType("");
      setOutcome("");
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: m, variant: "destructive" });
    }
  }

  async function removeRule(ruleId: string) {
    try {
      await deleteRule.mutateAsync({ ruleId, pipelineId });
      toast({ title: "Regla eliminada" });
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: m, variant: "destructive" });
    }
  }

  const showFilters = event === "activity_completed" || event === "task_completed";

  return (
    <div className="ml-8 rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Reglas de avance automático
      </div>

      {stageRules.length === 0 && (
        <div className="text-xs text-muted-foreground">
          Sin reglas. Cuando ocurra un evento, el deal se quedará en esta etapa.
        </div>
      )}

      {stageRules.map((r) => {
        const toStage = stages.find(s => s.id === r.toStageId);
        const label = EVENT_OPTIONS.find(e => e.value === r.triggerEvent)?.label ?? r.triggerEvent;
        const filters = Object.entries(r.triggerFilters).map(([k, v]) => `${k}: ${v}`).join(", ");
        return (
          <div key={r.id} className="flex items-center gap-2 text-sm rounded-md border border-border bg-background px-2 py-1.5">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="flex-1 truncate">
              {label} → <span className="font-medium">{toStage?.name ?? "—"}</span>
              {filters && <span className="text-muted-foreground text-xs ml-1">({filters})</span>}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRule(r.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        );
      })}

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Evento</Label>
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {EVENT_OPTIONS.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mover a</Label>
            <Select value={toStageId} onValueChange={setToStageId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Etapa destino" />
              </SelectTrigger>
              <SelectContent>
                {stages.filter(s => s.id !== stage.id).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{event === "activity_completed" ? "Tipo de actividad" : "Tipo de tarea"}</Label>
              <Input
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                placeholder="Ej. meeting / maintenance"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resultado esperado</Label>
              <Input
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Ej. effective / completed"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        <Button size="sm" onClick={addRule} disabled={createRule.isPending || !event || !toStageId}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Agregar regla
        </Button>
      </div>
    </div>
  );
}

// keep Pipeline import
function _ignore(_: Pipeline) {}
_ignore;
