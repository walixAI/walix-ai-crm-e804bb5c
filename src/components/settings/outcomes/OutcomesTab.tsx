import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePipelines, useStages } from "@/lib/queries/pipeline";
import {
  ACTIVITY_KINDS, useActivityOutcomes, useUpsertActivityOutcome,
  useDeleteActivityOutcome, useSeedActivityOutcomes, STAGE_BEHAVIORS, type StageBehavior,
} from "@/lib/queries/activityOutcomes";
import { DiagnosticsSettings } from "./DiagnosticsSettings";

export function OutcomesTab() {
  const { data: pipelines = [] } = usePipelines();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const activePipelineId = pipelineId ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
  const { data: stages = [] } = useStages(activePipelineId);
  const { data: outcomes = [] } = useActivityOutcomes(activePipelineId);
  const upsert = useUpsertActivityOutcome();
  const del = useDeleteActivityOutcome();
  const seed = useSeedActivityOutcomes();

  const [newLabel, setNewLabel] = useState("");
  const [newStage, setNewStage] = useState<string>("all");
  const [newKind, setNewKind] = useState<string>("all");
  const [newMoves, setNewMoves] = useState<string>("none");
  const [newBehavior, setNewBehavior] = useState<StageBehavior>("stay");

  const byStage = useMemo(() => {
    const m = new Map<string, typeof outcomes>();
    for (const o of outcomes) {
      const key = o.stageId ?? "all";
      m.set(key, [...(m.get(key) ?? []), o]);
    }
    return m;
  }, [outcomes]);

  const stageName = (id: string | null) =>
    id ? stages.find((s) => s.id === id)?.name ?? "—" : "Todas las etapas";

  async function add() {
    if (!newLabel.trim()) return toast.error("Escribe el nombre de la tipificación");
    try {
      await upsert.mutateAsync({
        pipelineId: activePipelineId,
        stageId: newStage === "all" ? null : newStage,
        activityKind: newKind === "all" ? null : newKind,
        label: newLabel.trim(),
        movesToStageId: newMoves === "none" ? null : newMoves,
        stageBehavior: newMoves === "none" ? "stay" : newBehavior === "stay" ? "suggest" : newBehavior,
        requiresNextAction: true,
        position: 99,
        isActive: true,
      });
      setNewLabel("");
      toast.success("Tipificación creada");
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <Label className="text-xs">Pipeline</Label>
            <Select value={activePipelineId ?? ""} onValueChange={setPipelineId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={!activePipelineId || seed.isPending}
            onClick={async () => {
              try {
                await seed.mutateAsync(activePipelineId!);
                toast.success("Catálogo recomendado agregado");
              } catch (e: any) { toast.error(e?.message ?? "Error"); }
            }}
          >
            <Wand2 className="h-4 w-4" /> Agregar catálogo recomendado
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada tipificación se asocia a una etapa (o a todas) y puede mover automáticamente la oportunidad
          a otra etapa cuando el usuario la selecciona al registrar un seguimiento. Las oportunidades solo
          pueden avanzar: nunca regresan a una etapa anterior.
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Nueva tipificación</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div className="md:col-span-2">
            <Label className="text-xs">Resultado</Label>
            <Input className="h-9" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={80} placeholder="Ej. Solicitó cotización" />
          </div>
          <div>
            <Label className="text-xs">Etapa</Label>
            <Select value={newStage} onValueChange={setNewStage}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de actividad</Label>
            <Select value={newKind} onValueChange={setNewKind}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ACTIVITY_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mueve a</Label>
            <div className="flex gap-2">
              <Select value={newMoves} onValueChange={setNewMoves}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No mueve</SelectItem>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={add} disabled={upsert.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {newMoves !== "none" && (
          <div className="max-w-xs">
            <Label className="text-xs">Comportamiento</Label>
            <Select value={newBehavior === "stay" ? "suggest" : newBehavior} onValueChange={(v) => setNewBehavior(v as StageBehavior)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_BEHAVIORS.filter((b) => b.value !== "stay").map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label} — {b.hint}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {[...byStage.entries()].map(([key, list]) => (
        <Card key={key} className="p-4 space-y-2">
          <div className="text-sm font-semibold">{stageName(key === "all" ? null : key)}</div>
          {list.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2 border border-border rounded-lg px-3 py-2">
              <span className="text-sm font-medium flex-1 min-w-[160px]">{o.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {o.activityKind ? ACTIVITY_KINDS.find((k) => k.value === o.activityKind)?.label : "Todos los tipos"}
              </span>
              <Select
                value={o.movesToStageId ?? "none"}
                onValueChange={(v) => upsert.mutate({ ...o, pipelineId: o.pipelineId, movesToStageId: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No mueve etapa</SelectItem>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>Mover a: {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Switch
                  checked={o.requiresNextAction}
                  onCheckedChange={(v) => upsert.mutate({ ...o, pipelineId: o.pipelineId, requiresNextAction: v })}
                />
                <span className="text-[11px] text-muted-foreground">Próxima acción</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => del.mutate(o.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Card>
      ))}

      <div className="pt-2 border-t border-border">
        <DiagnosticsSettings />
      </div>
    </div>
  );
}