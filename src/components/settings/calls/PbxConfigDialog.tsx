import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
type MenuOpt = { digit: string; label: string; target: string; user_id?: string };

export function PbxConfigDialog({ channel, tenantId, open, onOpenChange, onSaved }: {
  channel: any; tenantId: string; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const [cfg, setCfg] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!channel) return;
    const c = channel.pbx_config ?? {};
    setCfg({
      enabled: c.enabled ?? true,
      welcome_message: c.welcome_message ?? "Gracias por llamar. Te comunicamos con tu asesor.",
      voicemail_message: c.voicemail_message ?? "Estamos fuera de horario. Deja tu mensaje y te llamamos.",
      hours: { days: [1, 2, 3, 4, 5], open: "09:00", close: "19:00", ...(c.hours ?? {}) },
      menu: c.menu ?? [{ digit: "1", label: "Admisiones", target: "assigned" }],
      queue_user_ids: c.queue_user_ids ?? [],
    });
  }, [channel]);

  const { data: members } = useQuery({
    queryKey: ["pbx-members", tenantId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").eq("tenant_id", tenantId).order("full_name");
      return data ?? [];
    },
  });

  const setHours = (k: string, v: any) => setCfg({ ...cfg, hours: { ...cfg.hours, [k]: v } });
  const setMenu = (i: number, patch: Partial<MenuOpt>) =>
    setCfg({ ...cfg, menu: cfg.menu.map((m: MenuOpt, j: number) => (j === i ? { ...m, ...patch } : m)) });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("call_channels").update({ pbx_config: cfg }).eq("id", channel.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Conmutador guardado");
    onSaved(); onOpenChange(false);
  };

  if (!channel) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Conmutador · {channel.name}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>Aplicar horario y menú</Label>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
          </div>

          <div className="space-y-1.5">
            <Label>Saludo de bienvenida</Label>
            <Textarea rows={2} value={cfg.welcome_message ?? ""} onChange={(e) => setCfg({ ...cfg, welcome_message: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Horario de atención</Label>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d, i) => {
                const on = cfg.hours?.days?.includes(i);
                return (
                  <Button key={d} type="button" size="sm" variant={on ? "default" : "outline"}
                    onClick={() => setHours("days", on ? cfg.hours.days.filter((x: number) => x !== i) : [...cfg.hours.days, i])}>
                    {d}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Input type="time" className="w-32" value={cfg.hours?.open ?? ""} onChange={(e) => setHours("open", e.target.value)} />
              <span className="text-sm text-muted-foreground">a</span>
              <Input type="time" className="w-32" value={cfg.hours?.close ?? ""} onChange={(e) => setHours("close", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Menú de opciones (marca 1, 2, 3…)</Label>
              <Button size="sm" variant="outline" onClick={() => setCfg({ ...cfg, menu: [...cfg.menu, { digit: String(cfg.menu.length + 1), label: "", target: "queue" }] })}>
                <Plus className="h-4 w-4 mr-1" /> Opción
              </Button>
            </div>
            {cfg.menu?.map((m: MenuOpt, i: number) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                <Input className="w-12" value={m.digit} maxLength={1} onChange={(e) => setMenu(i, { digit: e.target.value })} />
                <Input className="flex-1 min-w-[120px]" placeholder="Ej. Admisiones" value={m.label} onChange={(e) => setMenu(i, { label: e.target.value })} />
                <Select value={m.target} onValueChange={(v) => setMenu(i, { target: v })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Asesor asignado</SelectItem>
                    <SelectItem value="queue">Fila de asesores</SelectItem>
                    <SelectItem value="user">Persona específica</SelectItem>
                    <SelectItem value="voicemail">Buzón de voz</SelectItem>
                  </SelectContent>
                </Select>
                {m.target === "user" && (
                  <Select value={m.user_id ?? ""} onValueChange={(v) => setMenu(i, { user_id: v })}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Elegir" /></SelectTrigger>
                    <SelectContent>
                      {(members ?? []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? "Sin nombre"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button size="icon" variant="ghost" onClick={() => setCfg({ ...cfg, menu: cfg.menu.filter((_: any, j: number) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Fila de asesores (reciben números nuevos o sin asesor)</Label>
            <div className="flex flex-wrap gap-1.5">
              {(members ?? []).map((u: any) => {
                const on = cfg.queue_user_ids?.includes(u.id);
                return (
                  <Button key={u.id} type="button" size="sm" variant={on ? "default" : "outline"}
                    onClick={() => setCfg({ ...cfg, queue_user_ids: on ? cfg.queue_user_ids.filter((x: string) => x !== u.id) : [...cfg.queue_user_ids, u.id] })}>
                    {u.full_name ?? "Sin nombre"}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Se reparte al asesor de la fila con menos llamadas recibidas hoy.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Mensaje de buzón (fuera de horario)</Label>
            <Textarea rows={2} value={cfg.voicemail_message ?? ""} onChange={(e) => setCfg({ ...cfg, voicemail_message: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
