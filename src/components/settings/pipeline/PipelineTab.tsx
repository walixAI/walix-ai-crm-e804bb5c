import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Save, ChevronDown, ChevronRight } from "lucide-react";
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

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  position: number;
}

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
              Crea pipelines y reordena las etapas con arrastrar y soltar.
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
      color: "220 13% 65%",
      is_won: false,
      is_lost: false,
    };
    setStages((p) => [...p, newStage]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Persist all stages: delete removed, upsert kept/new
      const existing = stagesData ?? [];
      const keptIds = new Set(stages.filter((s) => !s.id.startsWith("tmp-")).map((s) => s.id));
      const toDelete = existing.filter((s) => !keptIds.has(s.id)).map((s) => s.id);
      if (toDelete.length) {
        await supabase.from("pipeline_stages").delete().in("id", toDelete);
      }
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        if (s.id.startsWith("tmp-")) {
          await supabase.from("pipeline_stages").insert({
            tenant_id: tenantId, pipeline_id: pipeline.id,
            name: s.name, color: s.color, position: i,
            is_won: s.is_won, is_lost: s.is_lost,
          });
        } else {
          await supabase.from("pipeline_stages").update({
            name: s.name, color: s.color, position: i,
          }).eq("id", s.id);
        }
      }
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
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Etapas</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={aiScoring} onCheckedChange={setAiScoring} />
                IA scoring activo
              </label>
              <Button size="sm" variant="outline" onClick={handleAddStage}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Etapa
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {stages.map((s) => (
                  <SortableStage
                    key={s.id}
                    stage={s}
                    canDelete={!s.is_won && !s.is_lost}
                    onChange={(patch) =>
                      setStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))
                    }
                    onDelete={() => setStages((prev) => prev.filter((x) => x.id !== s.id))}
                  />
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

// keep Pipeline import
function _ignore(_: Pipeline) {}
_ignore;