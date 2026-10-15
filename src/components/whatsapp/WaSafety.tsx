import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Ban, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";

/** Consentimiento y baja de WhatsApp del contacto. */
export function WaConsentControl({ contactId }: { contactId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["wa-consent", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("contacts")
        .select("wa_opt_out_at, wa_opt_out_reason, wa_consent_at, wa_consent_source").eq("id", contactId).maybeSingle();
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("contacts").update(patch as any).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-consent", contactId] }),
    onError: () => toast.error("No se pudo guardar"),
  });
  if (!data) return null;
  if (data.wa_opt_out_at) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs space-y-1">
        <p className="flex items-center gap-1.5 font-medium text-destructive"><Ban className="h-3.5 w-3.5" /> Pidió no recibir WhatsApp</p>
        <p className="text-muted-foreground">No recibirá campañas, plantillas ni respuestas del bot. Si vuelve a escribir, un asesor puede contestarle.</p>
      </div>
    );
  }
  if (data.wa_consent_at) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Aceptó WhatsApp{data.wa_consent_source ? ` · ${data.wa_consent_source}` : ""}
      </p>
    );
  }
  return (
    <div className="rounded-md border border-border p-2 text-xs space-y-1.5">
      <p className="flex items-center gap-1.5 font-medium"><ShieldAlert className="h-3.5 w-3.5" /> Sin permiso para escribirle primero</p>
      <p className="text-muted-foreground">Márcalo solo si el contacto te dio su autorización para recibir WhatsApp.</p>
      <Button size="sm" variant="outline" className="h-7 text-xs w-full" disabled={save.isPending}
        onClick={() => save.mutate({ wa_consent_at: new Date().toISOString(), wa_consent_source: "marcado por asesor" })}>
        El contacto aceptó recibir WhatsApp
      </Button>
    </div>
  );
}

/** Semáforo de calidad y pausa del número. */
export function ChannelSafety({ channel, isAdmin }: { channel: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const resume = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("whatsapp_channels").update({ paused_at: null, pause_reason: null } as any).eq("id", channel.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Envíos reanudados"); qc.invalidateQueries(); },
    onError: () => toast.error("No se pudieron reanudar los envíos"),
  });
  const q = channel?.quality_rating as string | null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {q && <WBadge variant={q === "GREEN" ? "success" : q === "YELLOW" ? "warning" : "danger"}>
        Calidad {q === "GREEN" ? "alta" : q === "YELLOW" ? "media" : "baja"}
      </WBadge>}
      {channel?.paused_at && (
        <>
          <WBadge variant="danger"><PauseCircle className="h-3 w-3" /> Envíos pausados</WBadge>
          {channel.pause_reason && <span className="text-xs text-muted-foreground">{channel.pause_reason}</span>}
          {isAdmin && <Button size="sm" variant="outline" className="h-7 text-xs" disabled={resume.isPending} onClick={() => resume.mutate()}>Reanudar envíos</Button>}
        </>
      )}
    </div>
  );
}
