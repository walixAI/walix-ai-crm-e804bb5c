import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { updateAgent, type AiAgent } from "@/services/agents";
import { buildCron, parseCron, describeCron, PRESET_LABELS, type SchedulePreset } from "./scheduleHelpers";

interface Props {
  agent: AiAgent | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const BRIEFING_SECTIONS = [
  { key: "include_deals",    label: "Oportunidades" },
  { key: "include_contacts", label: "Contactos" },
  { key: "include_tasks",    label: "Tareas" },
  { key: "include_metrics",  label: "Métricas" },
] as const;

export function AgentConfigDialog({ agent, open, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [preset, setPreset] = useState<SchedulePreset>("weekdays");
  const [time, setTime] = useState("09:00");
  const [time2, setTime2] = useState("18:00");
  const [maxActions, setMaxActions] = useState(10);
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!agent) return;
    setName(agent.name);
    setDescription(agent.description ?? "");
    const p = parseCron(agent.schedule);
    setPreset(p.preset); setTime(p.time); setTime2(p.time2);
    setMaxActions(agent.max_actions_per_run);
    setConfig(agent.config ?? {});
  }, [agent]);

  if (!agent) return null;
  const cronExpr = buildCron(preset, time, time2);

  async function save() {
    if (!agent) return;
    setSaving(true);
    try {
      await updateAgent(agent.id, {
        name, description, schedule: cronExpr,
        max_actions_per_run: maxActions, config,
      });
      toast.success("Agente actualizado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar agente</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-3">
            <Label>Frecuencia</Label>
            <RadioGroup value={preset} onValueChange={(v) => setPreset(v as SchedulePreset)} className="grid grid-cols-2 gap-2">
              {(Object.keys(PRESET_LABELS) as SchedulePreset[]).map((k) => (
                <label key={k} className="flex items-center gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/40">
                  <RadioGroupItem value={k} id={`p-${k}`} />
                  <span className="text-sm">{PRESET_LABELS[k]}</span>
                </label>
              ))}
            </RadioGroup>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Hora</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
              </div>
              {preset === "twice_daily" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">y</Label>
                  <Input type="time" value={time2} onChange={(e) => setTime2(e.target.value)} className="w-32" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se ejecutará: <span className="font-medium text-foreground">{describeCron(cronExpr)}</span> · zona Ciudad de México
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Máximo de acciones por ejecución</Label>
              <span className="text-sm font-medium">{maxActions}</span>
            </div>
            <Slider min={1} max={50} step={1} value={[maxActions]} onValueChange={([v]) => setMaxActions(v)} />
          </div>

          {agent.agent_type === "followup_watchdog" && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
              <Label className="text-xs uppercase tracking-wide">Configuración específica</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm">Alertar si no hay actividad en más de</span>
                <Input type="number" min={1} max={60} className="w-20"
                  value={config.inactive_days ?? 5}
                  onChange={(e) => setConfig({ ...config, inactive_days: Number(e.target.value) })} />
                <span className="text-sm">días</span>
              </div>
            </div>
          )}

          {agent.agent_type === "deal_risk_detector" && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label>Score de riesgo mínimo para alertar</Label>
                <span className="text-sm font-medium">{config.min_urgency_score ?? 60}</span>
              </div>
              <Slider min={0} max={100} step={5}
                value={[config.min_urgency_score ?? 60]}
                onValueChange={([v]) => setConfig({ ...config, min_urgency_score: v })} />
            </div>
          )}

          {agent.agent_type === "morning_briefing" && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
              <Label className="text-xs uppercase tracking-wide">Incluir en el briefing</Label>
              <div className="grid grid-cols-2 gap-2">
                {BRIEFING_SECTIONS.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={config[s.key] ?? true}
                      onCheckedChange={(v) => setConfig({ ...config, [s.key]: !!v })}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}