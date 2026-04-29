import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FlaskConical } from "lucide-react";
import type { AutomationCondition, TriggerType } from "@/lib/automations/registry";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  triggerType: TriggerType;
  triggerConfig: any;
  conditions: AutomationCondition[];
}

export function AutomationDryRunDialog({ open, onOpenChange, triggerType, triggerConfig }: Props) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<{ id: string; label: string; meta: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true); setErr(null); setMatches([]);
      try {
        if (triggerType === "deal_inactive") {
          const days = Number(triggerConfig?.days ?? 5);
          const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
          const { data, error } = await supabase
            .from("deals")
            .select("id,name,updated_at,is_won,is_lost")
            .lt("updated_at", cutoff).eq("is_won", false).eq("is_lost", false)
            .limit(20);
          if (error) throw error;
          setMatches((data ?? []).map((d: any) => ({
            id: d.id, label: d.name,
            meta: `Sin actividad desde ${new Date(d.updated_at).toLocaleDateString("es-MX")}`,
          })));
        } else if (triggerType === "deal_close_date_near") {
          const days = Number(triggerConfig?.days ?? 3);
          const limit = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
          const today = new Date().toISOString().slice(0, 10);
          const { data, error } = await supabase
            .from("deals")
            .select("id,name,expected_close_date")
            .gte("expected_close_date", today).lte("expected_close_date", limit)
            .eq("is_won", false).eq("is_lost", false)
            .limit(20);
          if (error) throw error;
          setMatches((data ?? []).map((d: any) => ({
            id: d.id, label: d.name, meta: `Cierre esperado: ${d.expected_close_date}`,
          })));
        } else if (triggerType === "contact_no_reply") {
          const days = Number(triggerConfig?.days ?? 7);
          const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
          const { data, error } = await supabase
            .from("conversations")
            .select("id,preview,last_message_at")
            .lt("last_message_at", cutoff).limit(20);
          if (error) throw error;
          setMatches((data ?? []).map((c: any) => ({
            id: c.id, label: c.preview ?? "(sin vista previa)",
            meta: `Último mensaje: ${c.last_message_at ? new Date(c.last_message_at).toLocaleDateString("es-MX") : "N/D"}`,
          })));
        } else {
          setErr("Este disparador es reactivo: solo se ejecuta cuando ocurre el evento. La simulación está disponible para disparadores basados en tiempo.");
        }
      } catch (e: any) {
        setErr(e.message ?? "Error en la simulación");
      } finally { setLoading(false); }
    })();
  }, [open, triggerType, JSON.stringify(triggerConfig)]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-info" /> Simulación</DialogTitle>
          <DialogDescription>
            Te mostramos a qué entidades aplicaría hoy esta automatización. No se ejecutarán acciones.
          </DialogDescription>
        </DialogHeader>
        {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</div>}
        {err && <p className="text-xs text-warning">{err}</p>}
        {!loading && !err && (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            <p className="text-sm">
              <span className="font-semibold">{matches.length}</span> entidad{matches.length === 1 ? "" : "es"} coincidirían ahora mismo.
            </p>
            {matches.map((m) => (
              <div key={m.id} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-medium truncate">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.meta}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}