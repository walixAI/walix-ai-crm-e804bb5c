import { useEffect, useState } from "react";
import { CalendarIcon, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  useContactsLite, useCreateDeal, usePipelines, useStages, type PipelineStage,
} from "@/lib/queries/pipeline";
import { useProductCategories } from "@/lib/queries/monthlyGoals";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toLocalInput } from "@/lib/format/localDatetime";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  stages: PipelineStage[];
  defaultStageId?: string | null;
  /** Preselecciona (y fija) el contacto, p. ej. al crear desde su ficha. */
  defaultContactId?: string | null;
  /** Se llama con el id de la oportunidad creada. */
  onCreated?: (dealId: string) => void;
}

const sources = ["WhatsApp", "Formulario web", "Referido", "Manual"];

export function NewDealDialog({ open, onOpenChange, stages, defaultStageId, defaultContactId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [pipelineId, setPipelineId] = useState<string>("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [closeDate, setCloseDate] = useState<Date | undefined>();
  const [source, setSource] = useState("Manual");
  const [notes, setNotes] = useState("");
  const [aiAuto, setAiAuto] = useState(true);
  const [probability, setProbability] = useState(50);
  const [productCategoryId, setProductCategoryId] = useState<string>("");
  const [withTask, setWithTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const { data: contacts = [] } = useContactsLite();
  const { data: productCategories = [] } = useProductCategories();
  const { data: pipelines = [] } = usePipelines();
  const { data: pipelineStages = [] } = useStages(pipelineId || null);
  const create = useCreateDeal();
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  const qc = useQueryClient();

  /** Mañana a las 10:00, como fecha sugerida de la agenda. */
  function defaultTaskDue() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return toLocalInput(d);
  }

  // Solo se permite crear en las dos primeras etapas del pipeline elegido.
  const entryStages = pipelineStages
    .filter((s) => !s.isWon && !s.isLost)
    .sort((a, b) => a.position - b.position)
    .slice(0, 2);

  useEffect(() => {
    if (!open) return;
    setName(""); setAmount(""); setContactId(defaultContactId ?? null); setContactSearch("");
    setCloseDate(undefined); setSource("Manual"); setNotes("");
    setAiAuto(true); setProbability(50);
    setProductCategoryId("");
    setStageId("");
    setWithTask(false); setTaskTitle(""); setTaskDue(defaultTaskDue());
    // Solo al abrir: evita que un refetch de pipelines/etapas borre lo que el usuario ya escribió.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selecciona el pipeline por defecto en cuanto haya datos (sin resetear el formulario).
  useEffect(() => {
    if (!open || pipelineId) return;
    const fromDefault = defaultStageId ? stages.find((s) => s.id === defaultStageId)?.pipelineId : null;
    const next = fromDefault ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? "";
    if (next) setPipelineId(next);
  }, [open, pipelineId, defaultStageId, stages, pipelines]);

  // Al cambiar de pipeline, seleccionar la primera etapa disponible.
  useEffect(() => {
    if (!entryStages.length) { setStageId(""); return; }
    if (!entryStages.some((s) => s.id === stageId)) setStageId(entryStages[0].id);
  }, [pipelineId, pipelineStages]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredContacts = contactSearch
    ? contacts.filter(c => `${c.name} ${c.lastName ?? ""}`.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts.slice(0, 30);
  const selectedContact = contacts.find(c => c.id === contactId);

  async function onSubmit() {
    if (!name.trim()) { toast.error("Escribe el nombre de la oportunidad"); return; }
    if (!amount) { toast.error("Captura el monto"); return; }
    if (!stageId) { toast.error("Selecciona pipeline y etapa inicial"); return; }
    if (!productCategoryId) { toast.error("Selecciona la categoría / producto"); return; }
    if (withTask && !taskTitle.trim()) { toast.error("Escribe el título de la tarea"); return; }
    if (withTask && !taskDue) { toast.error("Indica la fecha de la tarea"); return; }
    try {
      const created: any = await create.mutateAsync({
        name: name.trim(),
        amount: Number(amount),
        probability,
        stageId,
        contactId,
        expectedCloseDate: closeDate ? closeDate.toISOString().slice(0, 10) : null,
        source,
        notes: notes.trim() || null,
        productCategoryId,
      });
      if (withTask && created?.id && tenantId) {
        const { error } = await (supabase as any).from("tasks").insert({
          tenant_id: tenantId,
          deal_id: created.id,
          contact_id: contactId,
          title: taskTitle.trim(),
          due_at: new Date(taskDue).toISOString(),
          assignee_id: user?.id ?? null,
        });
        if (error) toast.error(`Oportunidad creada, pero la tarea falló: ${error.message}`);
        else {
          qc.invalidateQueries({ queryKey: ["tasks"] });
          qc.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
          qc.invalidateQueries({ queryKey: ["pipeline-deal-tasks-map"] });
        }
      }
      toast.success("Oportunidad creada");
      if (created?.id) onCreated?.(created.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el oportunidad");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Nueva Oportunidad</DialogTitle>
          <DialogDescription>Agrega una nueva oportunidad al pipeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto px-6 pb-2">
          <div className="space-y-1.5">
            <Label>Nombre del deal*</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Plan anual Premium" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto MXN*</Label>
              <Input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Pipeline*</Label>
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Etapa inicial</Label>
            <Select value={stageId} onValueChange={setStageId} disabled={!entryStages.length}>
              <SelectTrigger><SelectValue placeholder={pipelineId ? "Selecciona" : "Elige primero un pipeline"} /></SelectTrigger>
              <SelectContent>
                {entryStages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Las oportunidades nuevas inician en las primeras etapas del pipeline.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Contacto vinculado</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  {selectedContact ? `${selectedContact.name} ${selectedContact.lastName ?? ""}` : "Buscar contacto…"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar…" value={contactSearch} onValueChange={setContactSearch} />
                  <CommandList>
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandGroup>
                      {filteredContacts.map(c => (
                        <CommandItem key={c.id} value={c.id} onSelect={() => setContactId(c.id)}>
                          {c.name} {c.lastName ?? ""}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fuente</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría / producto*</Label>
              <Select value={productCategoryId} onValueChange={setProductCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {productCategories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de cierre</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal", !closeDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {closeDate ? format(closeDate, "PPP", { locale: es }) : "Selecciona"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={closeDate} onSelect={setCloseDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Probabilidad por IA</Label>
              <Switch checked={aiAuto} onCheckedChange={setAiAuto} />
            </div>
            {!aiAuto && (
              <div className="pt-1">
                <Slider value={[probability]} onValueChange={([v]) => setProbability(v)} min={0} max={100} step={5} />
                <div className="text-xs text-muted-foreground mt-1">{probability}%</div>
              </div>
            )}
            {aiAuto && <div className="text-xs text-muted-foreground">La IA estimará la probabilidad inicial (50% por defecto).</div>}
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Detalles adicionales…" />
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Agendar tarea de seguimiento</Label>
              <Switch checked={withTask} onCheckedChange={setWithTask} />
            </div>
            {withTask ? (
              <div className="space-y-2 pt-1">
                <Input
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Ej. Llamar para confirmar visita"
                />
                <Input
                  type="datetime-local"
                  value={taskDue}
                  onChange={e => setTaskDue(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  La tarea queda ligada a esta oportunidad y aparece en Mi Día.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Crea también una agenda para no perder el seguimiento.</p>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending ? "Creando…" : "Crear Oportunidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
