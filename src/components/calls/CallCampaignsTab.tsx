import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Megaphone, Plus, Pause, Play, CheckCircle2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const CAMP_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "outline" },
  active: { label: "Activa", variant: "default" },
  paused: { label: "Pausada", variant: "secondary" },
  finished: { label: "Terminada", variant: "outline" },
};

export default function CallCampaignsTab() {
  const { activeTenantId, roles } = useAuth();
  const qc = useQueryClient();
  const canManage = roles.some((r) => ["tenant_admin", "tenant_owner", "sales_manager"].includes(r));
  const [open, setOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["call-campaigns", activeTenantId],
    enabled: !!activeTenantId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_campaigns")
        .select("id, name, status, schedule, redial_rules, created_at, call_channels(name, phone_number)")
        .eq("tenant_id", activeTenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["call-campaign-counts", activeTenantId],
    enabled: !!activeTenantId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_campaign_contacts")
        .select("campaign_id, status")
        .eq("tenant_id", activeTenantId!);
      if (error) throw error;
      const map: Record<string, { pending: number; calling: number; done: number; failed: number; skipped: number }> = {};
      for (const r of data ?? []) {
        map[r.campaign_id] ??= { pending: 0, calling: 0, done: 0, failed: 0, skipped: 0 };
        (map[r.campaign_id] as any)[r.status] = ((map[r.campaign_id] as any)[r.status] ?? 0) + 1;
      }
      return map;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("call_campaigns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call-campaigns", activeTenantId] });
      toast.success("Campaña actualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo actualizar"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Marcación automática: el sistema llama a los contactos y remarca según las reglas de cada campaña.
        </p>
        {canManage && (
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva campaña
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (campaigns ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Aún no hay campañas de llamadas.</p>
          {canManage && <p className="text-sm">Crea la primera con «Nueva campaña».</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {(campaigns ?? []).map((c: any) => {
            const st = CAMP_STATUS[c.status] ?? { label: c.status, variant: "outline" as const };
            const k = counts?.[c.id] ?? { pending: 0, calling: 0, done: 0, failed: 0, skipped: 0 };
            const total = k.pending + k.calling + k.done + k.failed + k.skipped;
            const rules = c.redial_rules ?? {};
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {c.call_channels?.name ?? "Canal"} · {c.call_channels?.phone_number ?? ""}
                  </span>
                  <div className="ml-auto flex gap-2">
                    {canManage && c.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: c.id, status: "paused" })}>
                        <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                      </Button>
                    )}
                    {canManage && (c.status === "paused" || c.status === "draft") && (
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: c.id, status: "active" })}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Activar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {total} contactos</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> {k.done} atendidos</span>
                  <span>{k.pending} pendientes · {k.calling} en curso · {k.failed} sin éxito</span>
                  <span>
                    Reintenta {rules.max_attempts ?? 3}× cada {rules.interval_hours ?? 2} h
                    {rules.action === "schedule" ? " (agenda manual)" : ""}
                  </span>
                </div>
                {total > 0 && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.round(((k.done + k.failed + k.skipped) / total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateCampaignDialog open={open} onOpenChange={setOpen} tenantId={activeTenantId} />
    </div>
  );
}

function CreateCampaignDialog({
  open, onOpenChange, tenantId,
}: { open: boolean; onOpenChange: (v: boolean) => void; tenantId: string | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [intervalHours, setIntervalHours] = useState("2");
  const [action, setAction] = useState<"redial" | "schedule">("redial");
  const [startHour, setStartHour] = useState("9");
  const [endHour, setEndHour] = useState("19");
  const [stage, setStage] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const { data: channels } = useQuery({
    queryKey: ["call-channels", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_channels")
        .select("id, name, phone_number, status")
        .eq("tenant_id", tenantId!)
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = async () => {
    if (!tenantId) return;
    if (!name.trim()) return toast.error("Ponle un nombre a la campaña");
    if (!channelId) return toast.error("Elige un canal de llamadas");
    setSaving(true);
    try {
      const redial_rules = {
        max_attempts: Math.max(1, parseInt(maxAttempts) || 3),
        interval_hours: Math.max(1, parseInt(intervalHours) || 2),
        action,
      };
      const schedule = {
        start_hour: Math.min(23, Math.max(0, parseInt(startHour) || 9)),
        end_hour: Math.min(24, Math.max(1, parseInt(endHour) || 19)),
      };

      // Contactos objetivo: con teléfono; si se eligió etapa, solo los que tienen oportunidad en esa etapa
      let contactIds: string[] = [];
      if (stage === "all") {
        const { data, error } = await supabase
          .from("contacts")
          .select("id")
          .eq("tenant_id", tenantId)
          .not("phone", "is", null);
        if (error) throw error;
        contactIds = (data ?? []).map((c) => c.id);
      } else {
        const { data, error } = await supabase
          .from("deals")
          .select("contact_id, contacts!inner(id, phone)")
          .eq("tenant_id", tenantId)
          .eq("stage_id", stage)
          .not("contacts.phone", "is", null);
        if (error) throw error;
        contactIds = [...new Set((data ?? []).map((d: any) => d.contact_id))];
      }
      if (contactIds.length === 0) {
        toast.error("No hay contactos con teléfono para esa selección");
        return;
      }

      const { data: camp, error: campErr } = await supabase
        .from("call_campaigns")
        .insert({ tenant_id: tenantId, channel_id: channelId, name: name.trim(), status: "active", schedule, redial_rules })
        .select("id")
        .single();
      if (campErr) throw campErr;

      const rows = contactIds.map((cid) => ({
        tenant_id: tenantId,
        campaign_id: camp.id,
        contact_id: cid,
        status: "pending" as const,
        next_attempt_at: new Date().toISOString(),
      }));
      const { error: rowsErr } = await supabase.from("call_campaign_contacts").insert(rows);
      if (rowsErr) throw rowsErr;

      toast.success(`Campaña creada con ${contactIds.length} contactos. El marcador empieza en minutos.`);
      qc.invalidateQueries({ queryKey: ["call-campaigns", tenantId] });
      qc.invalidateQueries({ queryKey: ["call-campaign-counts", tenantId] });
      onOpenChange(false);
      setName(""); setChannelId(""); setStage("all");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo crear la campaña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva campaña de llamadas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Reactivación de leads de octubre" />
          </div>
          <div className="space-y-1.5">
            <Label>Canal</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Elige el número de salida" /></SelectTrigger>
              <SelectContent>
                {(channels ?? []).map((ch: any) => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name} · {ch.phone_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>¿A quiénes llamar?</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los contactos con teléfono</SelectItem>
                {(stages ?? []).map((s) => (
                  <SelectItem key={s} value={s}>Leads en etapa «{s}»</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Intentos máximos</Label>
              <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cada (horas)</Label>
              <Input type="number" min={1} max={72} value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Si no contestan</Label>
            <Select value={action} onValueChange={(v) => setAction(v as "redial" | "schedule")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="redial">Remarcar automáticamente</SelectItem>
                <SelectItem value="schedule">Dejar pendiente para agendar después</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Llamar desde las</Label>
              <Input type="number" min={0} max={23} value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta las</Label>
              <Input type="number" min={1} max={24} value={endHour} onChange={(e) => setEndHour(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create} disabled={saving}>{saving ? "Creando…" : "Crear y activar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
