import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CampaignRuleEditor } from "./CampaignRuleEditor";
import { CampaignSequenceEditor, type StepDraft } from "./CampaignSequenceEditor";
import {
  OBJECTIVES, useCampaignSteps, useSaveCampaign,
  type CampaignConditions, type CampaignSchedule, type WaCampaign,
} from "@/lib/queries/whatsappCampaigns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: WaCampaign | null;
}

const DAYS = [
  { v: 1, l: "L" }, { v: 2, l: "M" }, { v: 3, l: "X" }, { v: 4, l: "J" },
  { v: 5, l: "V" }, { v: 6, l: "S" }, { v: 0, l: "D" },
];

export function CampaignDialog({ open, onOpenChange, campaign }: Props) {
  const save = useSaveCampaign();
  const { data: existingSteps } = useCampaignSteps(campaign?.id);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("calificar");
  const [priority, setPriority] = useState(10);
  const [mode, setMode] = useState<"filters" | "prompt">("filters");
  const [prompt, setPrompt] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [conditions, setConditions] = useState<CampaignConditions>({});
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [schedule, setSchedule] = useState<CampaignSchedule>({ days: [1, 2, 3, 4, 5], start: "09:00", end: "20:00", tz: "America/Mexico_City" });
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnStage, setStopOnStage] = useState(true);
  const [stopOnClosed, setStopOnClosed] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(campaign?.name ?? "");
    setObjective(campaign?.objective ?? "calificar");
    setPriority(campaign?.priority ?? 10);
    setMode(campaign?.rule_mode ?? "filters");
    setPrompt(campaign?.rule_prompt ?? "");
    setUnresolved((campaign?.rule_unresolved as string[]) ?? []);
    setConditions((campaign?.conditions as CampaignConditions) ?? {});
    setSchedule((campaign?.schedule as CampaignSchedule) ?? { days: [1, 2, 3, 4, 5], start: "09:00", end: "20:00", tz: "America/Mexico_City" });
    setStopOnReply(campaign?.stop_on_reply ?? true);
    setStopOnStage(campaign?.stop_on_stage_change ?? true);
    setStopOnClosed(campaign?.stop_on_closed ?? true);
    setIsActive(campaign?.is_active ?? true);
  }, [open, campaign]);

  useEffect(() => {
    if (open && campaign?.id && existingSteps) setSteps(existingSteps);
    if (open && !campaign) setSteps([{ kind: "template", wait_hours: 0 }]);
  }, [open, campaign, existingSteps]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Ponle un nombre a la campaña");
    if (steps.length === 0) return toast.error("Agrega al menos un paso");
    try {
      await save.mutateAsync({
        id: campaign?.id,
        name: name.trim(),
        objective,
        priority,
        rule_mode: mode,
        rule_prompt: mode === "prompt" ? prompt : null,
        rule_unresolved: unresolved as any,
        conditions: conditions as any,
        schedule: schedule as any,
        stop_on_reply: stopOnReply,
        stop_on_stage_change: stopOnStage,
        stop_on_closed: stopOnClosed,
        is_active: isActive,
        steps,
      });
      toast.success(campaign ? "Campaña actualizada" : "Campaña creada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la campaña");
    }
  };

  const toggleDay = (d: number) => {
    const days = schedule.days ?? [];
    setSchedule({ ...schedule, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{campaign ? "Editar campaña" : "Nueva campaña de WhatsApp"}</DialogTitle>
          <DialogDescription>
            Define a quién se enrola, qué se le manda y cuándo se detiene el seguimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="rule">Enrolamiento</TabsTrigger>
              <TabsTrigger value="sequence">Secuencia</TabsTrigger>
              <TabsTrigger value="rules">Horario y corte</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bienvenida leads Meta Ads" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Objetivo</Label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridad (menor gana)</Label>
                  <Input type="number" min={1} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Campaña activa</p>
                  <p className="text-xs text-muted-foreground">Si la apagas, deja de enrolar y de enviar.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </TabsContent>

            <TabsContent value="rule" className="pt-4">
              <CampaignRuleEditor
                mode={mode} onModeChange={setMode}
                conditions={conditions} onConditionsChange={setConditions}
                prompt={prompt} onPromptChange={setPrompt}
                unresolved={unresolved} onUnresolvedChange={setUnresolved}
                onObjectiveSuggested={setObjective}
              />
            </TabsContent>

            <TabsContent value="sequence" className="pt-4">
              <CampaignSequenceEditor steps={steps} onChange={setSteps} />
            </TabsContent>

            <TabsContent value="rules" className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label>Días permitidos</Label>
                <div className="flex gap-1.5">
                  {DAYS.map((d) => (
                    <Button
                      key={d.v} type="button" size="sm"
                      variant={(schedule.days ?? []).includes(d.v) ? "default" : "outline"}
                      onClick={() => toggleDay(d.v)}
                    >
                      {d.l}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Desde</Label>
                  <Input type="time" value={schedule.start ?? "09:00"} onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hasta</Label>
                  <Input type="time" value={schedule.end ?? "20:00"} onChange={(e) => setSchedule({ ...schedule, end: e.target.value })} />
                </div>
              </div>
              {[
                { l: "Detener si el contacto responde", v: stopOnReply, s: setStopOnReply },
                { l: "Detener si cambia de etapa", v: stopOnStage, s: setStopOnStage },
                { l: "Detener si la oportunidad se cierra", v: stopOnClosed, s: setStopOnClosed },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between rounded-md border p-3">
                  <p className="text-sm">{r.l}</p>
                  <Switch checked={r.v} onCheckedChange={r.s} />
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar campaña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
