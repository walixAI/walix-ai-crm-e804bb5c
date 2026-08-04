import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCreateRecurrence, useUpdateRecurrence, type RecurrenceDefinition, type RecurrenceAction } from "@/lib/queries/recurrence";
import { useTenant } from "@/lib/queries/tenant";
import { Repeat, Plus, Trash2, Bell, CheckCircle2, Briefcase, MessageCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: RecurrenceDefinition | null;
}

const KINDS = [
  { value: "periodic", label: "Periódico (cada N meses)" },
  { value: "calendar", label: "Calendario (anual)" },
];

const ACTION_TYPES: { value: RecurrenceAction["type"]; label: string; icon: any }[] = [
  { value: "create_task", label: "Crear tarea", icon: CheckCircle2 },
  { value: "create_deal", label: "Crear oportunidad", icon: Briefcase },
  { value: "notify_owner", label: "Notificar al dueño", icon: Bell },
  { value: "send_whatsapp", label: "Enviar WhatsApp", icon: MessageCircle },
];

export function RecurrenceBuilderSheet({ open, onClose, editing }: Props) {
  const { toast } = useToast();
  const { data: tenant } = useTenant();
  const create = useCreateRecurrence();
  const update = useUpdateRecurrence();

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [kind, setKind] = useState<"periodic" | "calendar">(editing?.kind ?? "periodic");
  const [periodMonths, setPeriodMonths] = useState(editing?.period_months ?? 6);
  const [anticipationDays, setAnticipationDays] = useState(editing?.anticipation_days ?? 15);
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [actions, setActions] = useState<RecurrenceAction[]>(editing?.actions ?? [{ type: "create_task", config: { title: "" } }]);

  const reset = () => {
    setName("");
    setDescription("");
    setKind("periodic");
    setPeriodMonths(6);
    setAnticipationDays(15);
    setEnabled(true);
    setActions([{ type: "create_task", config: { title: "" } }]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addAction = () => {
    setActions([...actions, { type: "create_task", config: { title: "" } }]);
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, patch: Partial<RecurrenceAction>) => {
    setActions(actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const updateActionConfig = (idx: number, patch: Record<string, any>) => {
    setActions(actions.map((a, i) => (i === idx ? { ...a, config: { ...a.config, ...patch } } : a)));
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Falta el nombre", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        kind,
        period_months: kind === "periodic" ? periodMonths : null,
        anticipation_days: anticipationDays,
        actions,
        enabled,
      };
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Servicio recurrente actualizado" });
      } else {
        await create.mutateAsync(payload);
        toast({ title: "Servicio recurrente creado" });
      }
      handleClose();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            {editing ? "Editar servicio recurrente" : "Nuevo servicio recurrente"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-6">
          <div className="space-y-2">
            <Label htmlFor="r-name">Nombre del servicio</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mantenimiento de refrigeradores" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="r-desc">Descripción</Label>
            <Textarea id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para qué sirve este servicio recurrente" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{kind === "periodic" ? "Cada cuántos meses" : "Meses del año"}</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={periodMonths ?? ""}
                onChange={(e) => setPeriodMonths(Number(e.target.value))}
                disabled={kind === "calendar"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Días de anticipación para avisar</Label>
            <Input type="number" min={0} max={90} value={anticipationDays} onChange={(e) => setAnticipationDays(Number(e.target.value))} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Activo</p>
              <p className="text-sm text-muted-foreground">Se ejecutará según la programación.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Acciones automáticas</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAction}>
                <Plus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            </div>
            {actions.map((action, idx) => {
              const Icon = ACTION_TYPES.find((t) => t.value === action.type)?.icon ?? CheckCircle2;
              return (
                <div key={idx} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Select value={action.type} onValueChange={(v) => updateAction(idx, { type: v as RecurrenceAction["type"] })}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAction(idx)} disabled={actions.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {action.type === "create_task" && (
                    <>
                      <Input
                        placeholder="Título de la tarea"
                        value={action.config?.title || ""}
                        onChange={(e) => updateActionConfig(idx, { title: e.target.value })}
                      />
                      <Textarea
                        placeholder="Descripción de la tarea"
                        value={action.config?.description || ""}
                        onChange={(e) => updateActionConfig(idx, { description: e.target.value })}
                      />
                    </>
                  )}
                  {action.type === "create_deal" && (
                    <Input
                      placeholder="Título de la oportunidad"
                      value={action.config?.title || ""}
                      onChange={(e) => updateActionConfig(idx, { title: e.target.value })}
                    />
                  )}
                  {action.type === "notify_owner" && (
                    <Textarea
                      placeholder="Mensaje para el dueño"
                      value={action.config?.message || ""}
                      onChange={(e) => updateActionConfig(idx, { message: e.target.value })}
                    />
                  )}
                  {action.type === "send_whatsapp" && (
                    <Textarea
                      placeholder="Mensaje de WhatsApp"
                      value={action.config?.message || ""}
                      onChange={(e) => updateActionConfig(idx, { message: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <SheetFooter className="pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={create.isPending || update.isPending}>
            {editing ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
