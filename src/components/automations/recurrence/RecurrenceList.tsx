import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useRecurrences, useUpdateRecurrence, useDeleteRecurrence, type RecurrenceDefinition } from "@/lib/queries/recurrence";
import { useToast } from "@/hooks/use-toast";
import { RecurrenceSubscribeDialog } from "./RecurrenceSubscribeDialog";
import { Repeat, Plus, Pencil, Trash2, CalendarClock, CheckCircle2, Bell, Briefcase, MessageCircle, UserPlus } from "lucide-react";

interface Props {
  onEdit: (r: RecurrenceDefinition) => void;
  onNew: () => void;
}

const ACTION_ICONS: Record<string, any> = {
  create_task: CheckCircle2,
  create_deal: Briefcase,
  notify_owner: Bell,
  send_whatsapp: MessageCircle,
};

export function RecurrenceList({ onEdit, onNew }: Props) {
  const { data: recurrences = [], isLoading } = useRecurrences();
  const update = useUpdateRecurrence();
  const del = useDeleteRecurrence();
  const { toast } = useToast();
  const [subscribeRecurrence, setSubscribeRecurrence] = useState<RecurrenceDefinition | null>(null);

  const toggle = async (r: RecurrenceDefinition) => {
    try {
      await update.mutateAsync({ id: r.id, enabled: !r.enabled });
      toast({ title: r.enabled ? "Servicio pausado" : "Servicio activado" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (recurrences.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
        <Repeat className="h-10 w-10 mx-auto text-muted-foreground" />
        <h3 className="text-lg font-semibold">No hay servicios recurrentes</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Crea recordatorios automáticos de mantenimiento, renovaciones o visitas periódicas. Ideal para equipos, servicios o clientes recurrentes.
        </p>
        <Button onClick={onNew}><Plus className="h-4 w-4 mr-1" />Crear servicio recurrente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{recurrences.length} servicio(s) configurado(s)</p>
        <Button onClick={onNew}><Plus className="h-4 w-4 mr-1" />Nuevo servicio</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {recurrences.map((r) => (
          <Card key={r.id} className={r.enabled ? "" : "opacity-70"}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold line-clamp-1">{r.name}</h4>
                </div>
                <Switch checked={r.enabled} onCheckedChange={() => toggle(r)} />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{r.description || "Sin descripción"}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {r.kind === "periodic" ? `Cada ${r.period_months} mes(es)` : "Anual (calendario)"}
                <span className="mx-1">·</span>
                {r.anticipation_days}d de anticipación
              </div>
              <div className="flex flex-wrap gap-1">
                {r.actions.map((a, i) => {
                  const Icon = ACTION_ICONS[a.type] ?? CheckCircle2;
                  return (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                      <Icon className="h-3 w-3" />
                      {a.type.replace("_", " ")}
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-1 pt-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={async () => {
                  try { await del.mutateAsync(r.id); toast({ title: "Eliminado" }); }
                  catch (e: any) { toast({ title: "Error", description: e?.message ?? "", variant: "destructive" }); }
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
