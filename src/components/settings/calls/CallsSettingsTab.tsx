import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props { tenantId: string }

export function CallsSettingsTab({ tenantId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", provider: "simulated", phone_number: "", record_calls: true, recording_notice: "" });

  const { data: channels } = useQuery({
    queryKey: ["call-channels", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_channels").select("*").eq("tenant_id", tenantId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        phone_number: form.phone_number.trim() || null,
        record_calls: form.record_calls,
        recording_notice: form.recording_notice.trim() || null,
      };
      if (!payload.name) throw new Error("Ponle un nombre al canal");
      if (editing) {
        const { error } = await supabase.from("call_channels").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("call_channels").insert({ ...payload, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Canal actualizado" : "Canal creado");
      qc.invalidateQueries({ queryKey: ["call-channels", tenantId] });
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo guardar"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("call_channels")
        .update({ status: status === "active" ? "paused" : "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-channels", tenantId] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", provider: "simulated", phone_number: "", record_calls: true, recording_notice: "" });
    setOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name: c.name, provider: c.provider, phone_number: c.phone_number ?? "", record_calls: c.record_calls, recording_notice: c.recording_notice ?? "" });
    setOpen(true);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> Canal de llamadas
          </h2>
          <p className="text-sm text-muted-foreground">
            Configura el número y proveedor de telefonía. Los asesores llaman con un clic desde cada contacto.
          </p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo canal</Button>
      </div>

      {(channels ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin canal configurado. Crea uno en modo «Simulado» para probar, o conecta Telnyx/Twilio cuando tengas la cuenta.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(channels ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant={c.status === "active" ? "default" : "secondary"}>
                    {c.status === "active" ? "Activo" : "Pausado"}
                  </Badge>
                  <Badge variant="outline">{c.provider === "simulated" ? "Simulado" : c.provider}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.phone_number ?? "Sin número"} · {c.record_calls ? "Graba llamadas" : "Sin grabación"}
                </p>
              </div>
              <Switch checked={c.status === "active"} onCheckedChange={() => toggleStatus.mutate({ id: c.id, status: c.status })} />
              <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Protección y cumplimiento</p>
        <p>· La cuenta del proveedor (Telnyx/Twilio) debe ser propiedad del cliente, igual que con Meta.</p>
        <p>· Activa el aviso de grabación si tu país lo exige; quedará en cada llamada.</p>
        <p>· Cada llamada queda registrada en la Actividad del lead con su resultado.</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar canal" : "Nuevo canal de llamadas"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Admisiones SCALA" />
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simulated">Simulado (pruebas, sin costo)</SelectItem>
                  <SelectItem value="telnyx">Telnyx</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                </SelectContent>
              </Select>
              {form.provider !== "simulated" && (
                <p className="text-xs text-muted-foreground">Las credenciales se configuran cuando conectemos la cuenta real. Por ahora el canal queda listo.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Número de teléfono</Label>
              <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+52 55 ..." />
            </div>
            <div className="flex items-center justify-between">
              <Label>Grabar llamadas</Label>
              <Switch checked={form.record_calls} onCheckedChange={(v) => setForm({ ...form, record_calls: v })} />
            </div>
            {form.record_calls && (
              <div className="space-y-1.5">
                <Label>Aviso de grabación (se anuncia al inicio)</Label>
                <Input value={form.recording_notice} onChange={(e) => setForm({ ...form, recording_notice: e.target.value })} placeholder="Esta llamada puede ser grabada para fines de calidad." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
