import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneIncoming, X, ArrowUpRight, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { playIncomingAlert, unlockIncomingAudio } from "./incoming-call-audio";

/** Personal alerts also cover unassigned callers routed to supervision. */
export function IncomingCallPopup() {
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [audible, setAudible] = useState(false);
  const audio = useRef<ReturnType<typeof playIncomingAlert> | null>(null);
  const sounded = useRef(new Set<string>());
  const key = ["incoming-call", tenantId, userId];

  const { data: call } = useQuery({
    queryKey: key,
    enabled: !!userId && !!tenantId,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      const { data, error } = await supabase.from("notifications")
        .select("id,title,body,type,data,created_at")
        .eq("tenant_id", tenantId).eq("user_id", userId)
        .in("type", ["inbound_call", "missed_inbound_call"]).is("read_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`incoming-calls-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tenantId]);

  useEffect(() => {
    const unlock = () => { void unlockIncomingAudio().then(setAudible); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  useEffect(() => () => { audio.current?.stop(); audio.current = null; }, [userId, tenantId, call?.id]);

  useEffect(() => {
    if (!call || sounded.current.has(call.id) || Date.now() - new Date(call.created_at).getTime() > 60000) return;
    if (!audible) return;
    sounded.current.add(call.id);
    audio.current?.stop();
    audio.current = playIncomingAlert(call.type === "inbound_call");
    return () => { audio.current?.stop(); audio.current = null; };
  }, [call?.id, audible, userId, tenantId]);

  if (!call) return null;
  const details = (call.data ?? {}) as Record<string, unknown>;
  const name = typeof details.caller_name === "string" ? details.caller_name : call.title.replace(/^Llamada entrante(?: no atendida)?: /, "");
  const phone = typeof details.from_number === "string" ? details.from_number : call.body?.split("Número: ")[1] ?? "Número no disponible";
  const missed = call.type === "missed_inbound_call";
  const act = async (openReport: boolean) => {
    audio.current?.stop();
    setBusy(true);
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", call.id).eq("tenant_id", tenantId ?? "").eq("user_id", userId ?? "");
    setBusy(false);
    if (error) { toast.error("No se pudo cerrar el aviso"); return; }
    await qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (openReport) navigate("/llamadas");
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) void act(false); }}>
      <DialogContent className="max-w-md border-success bg-success text-success-foreground text-center [&>button]:text-success-foreground" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
        <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-success-foreground/40 motion-safe:animate-pulse">
          <PhoneIncoming className="h-8 w-8" />
        </div>
        <DialogTitle className="text-center text-xl tracking-normal">{missed ? "Llamada entrante no atendida" : "Llamada entrante"}</DialogTitle>
        <DialogDescription className="text-success-foreground text-center">
          {missed ? "Registrada para devolver la llamada" : "Para atender en tu celular, contesta y presiona 1"}
        </DialogDescription>
        <div className="space-y-2 min-w-0">
          <p className="font-semibold text-lg break-words">{name}</p>
          {phone !== name && <p className="text-lg break-words">{phone}</p>}
          <p className="text-sm">{details.contact_id ? details.unassigned ? "Contacto sin asesor asignado" : "Contacto registrado" : "Número sin contacto registrado"}</p>
          <p className="text-sm">{new Date(call.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</p>
        </div>
        <Button variant="outline" className="bg-transparent text-success-foreground border-success-foreground/50 hover:bg-success-foreground/15 hover:text-success-foreground" onClick={async () => {
          const enabled = await unlockIncomingAudio(); setAudible(enabled);
          if (!enabled) toast.error("El navegador no permitió el sonido");
          else { sounded.current.add(call.id); audio.current?.stop(); audio.current = playIncomingAlert(!missed); }
        }}><Volume2 className="h-4 w-4 mr-2" /> {audible ? "Probar sonido" : "Activar sonido"}</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="bg-transparent text-success-foreground border-success-foreground/50 hover:bg-success-foreground/15 hover:text-success-foreground" disabled={busy} onClick={() => act(false)}>
          <X className="h-4 w-4 mr-1" /> Cerrar aviso
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => act(true)}>
          <ArrowUpRight className="h-4 w-4 mr-1" /> Ver llamadas
        </Button>
      </div>
      </DialogContent>
    </Dialog>
  );
}
