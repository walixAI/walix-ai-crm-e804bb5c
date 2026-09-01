import { useState } from "react";
import { Loader2, Lock, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { createCustomAgent } from "@/services/agents";
import { buildCron, describeCron, PRESET_LABELS, type SchedulePreset } from "./scheduleHelpers";

interface Props {
  tenantId: string;
  plan: string | undefined;
  onCreated: () => void;
}

const SCOPES = [
  { key: "pipeline",  label: "Pipeline / Oportunidades", tools: ["get_pipeline_status"] },
  { key: "contacts",  label: "Contactos",        tools: ["search_contacts", "get_contact_context"] },
  { key: "whatsapp",  label: "WhatsApp",         tools: ["search_whatsapp_messages"] },
  { key: "reports",   label: "Reportes",         tools: ["get_pipeline_status"] },
] as const;

const ACTION_LEVELS = {
  suggest:    { label: "Solo sugerir",                       tools: ["create_proactive_suggestion"] },
  with_tasks: { label: "Sugerir + crear tareas",             tools: ["create_proactive_suggestion", "create_task"] },
  full:       { label: "Sugerir + tareas + mover deals",     tools: ["create_proactive_suggestion", "create_task", "update_deal"] },
} as const;
type ActionLevel = keyof typeof ACTION_LEVELS;

const PLAN_ALLOWED = (plan: string | undefined) =>
  plan === "growth" || plan === "enterprise" || plan === "platform";

export function CustomAgentWizard({ tenantId, plan, onCreated }: Props) {
  const allowed = PLAN_ALLOWED(plan);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [scopes, setScopes] = useState<string[]>(["pipeline"]);
  const [actionLevel, setActionLevel] = useState<ActionLevel>("suggest");
  const [preset, setPreset] = useState<SchedulePreset>("weekdays");
  const [time, setTime] = useState("09:00");
  const [maxActions, setMaxActions] = useState(10);
  const [systemPrompt, setSystemPrompt] = useState("");

  function buildPrompt() {
    const scopeStr = scopes.map((s) => SCOPES.find((x) => x.key === s)?.label).filter(Boolean).join(", ");
    return `Eres un agente personalizado de Walix. Objetivo: ${goal}\n\nAccesos: ${scopeStr}.\nPermisos: ${ACTION_LEVELS[actionLevel].label}.\nSé conciso, accionable y siempre crea sugerencias proactivas en lugar de actuar sin confirmación cuando sea posible.`;
  }

  function next() {
    if (step === 4) setSystemPrompt(buildPrompt());
    setStep((s) => Math.min(5, s + 1));
  }
  function back() { setStep((s) => Math.max(1, s - 1)); }

  async function submit() {
    setSaving(true);
    try {
      const allowedTools = Array.from(new Set([
        ...scopes.flatMap((s) => SCOPES.find((x) => x.key === s)?.tools ?? []),
        ...ACTION_LEVELS[actionLevel].tools,
      ]));
      await createCustomAgent({
        tenant_id: tenantId,
        name, description: goal, system_prompt: systemPrompt,
        schedule: buildCron(preset, time),
        allowed_tools: allowedTools,
        max_actions_per_run: maxActions,
      });
      toast.success("Agente creado");
      onCreated();
      setOpen(false);
      // reset
      setStep(1); setName(""); setGoal(""); setScopes(["pipeline"]);
      setActionLevel("suggest"); setPreset("weekdays"); setTime("09:00");
      setMaxActions(10); setSystemPrompt("");
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setSaving(false); }
  }

  function handleClick() {
    if (!allowed) {
      toast.info("Disponible en los planes Growth y Enterprise.", { description: "Contacta a tu Account Manager para hacer upgrade." });
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <Button variant="outline" onClick={handleClick} className="gap-2">
        {allowed ? <Sparkles className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        Crear agente personalizado
        {!allowed && <Badge variant="secondary" className="ml-1 text-[10px]">Growth+</Badge>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear agente personalizado · Paso {step}/5</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4 min-h-[260px]">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Nombre del agente</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Recuperador de Carritos" />
                </div>
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Textarea rows={4} value={goal} onChange={(e) => setGoal(e.target.value)}
                    placeholder="Describe qué quieres que haga este agente cada vez que se ejecute…" />
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Label>¿Qué datos puede ver?</Label>
                {SCOPES.map((s) => (
                  <label key={s.key} className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40">
                    <Checkbox
                      checked={scopes.includes(s.key)}
                      onCheckedChange={(v) => setScopes((prev) => v ? [...prev, s.key] : prev.filter((x) => x !== s.key))}
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <Label>¿Qué acciones puede tomar?</Label>
                <RadioGroup value={actionLevel} onValueChange={(v) => setActionLevel(v as ActionLevel)} className="space-y-2">
                  {(Object.entries(ACTION_LEVELS) as [ActionLevel, { label: string }][]).map(([k, v]) => (
                    <label key={k} className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value={k} />
                      <span className="text-sm">{v.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <RadioGroup value={preset} onValueChange={(v) => setPreset(v as SchedulePreset)} className="grid grid-cols-2 gap-2">
                    {(Object.keys(PRESET_LABELS) as SchedulePreset[]).map((k) => (
                      <label key={k} className="flex items-center gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/40">
                        <RadioGroupItem value={k} />
                        <span className="text-sm">{PRESET_LABELS[k]}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
                  <p className="text-xs text-muted-foreground">{describeCron(buildCron(preset, time))}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Máximo de acciones por ejecución</Label>
                    <span className="text-sm font-medium">{maxActions}</span>
                  </div>
                  <Slider min={1} max={50} step={1} value={[maxActions]} onValueChange={([v]) => setMaxActions(v)} />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-2">
                <Label>System prompt (editable)</Label>
                <Textarea rows={10} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground">
                  Este es el prompt exacto que se enviará al modelo en cada ejecución.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 1}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
            </Button>
            {step < 5 ? (
              <Button onClick={next} disabled={(step === 1 && (!name || !goal)) || (step === 2 && scopes.length === 0)}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={saving || !systemPrompt}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Crear agente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}