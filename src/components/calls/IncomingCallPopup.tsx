import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneIncoming, X, ArrowUpRight, Volume2, Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { playIncomingAlert, unlockIncomingAudio } from "./incoming-call-audio";
import { useIncomingBrowserCall } from "./useIncomingBrowserCall";
import { CallAudioControls, type AudioSelection } from "./CallAudioControls";

/** Personal alerts also cover unassigned callers routed to supervision. */
export function IncomingCallPopup() {
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const voice = useIncomingBrowserCall(tenantId, userId);
  const [selection, setSelection] = useState<AudioSelection>({ input: "default", output: "default" });
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
      // Historical/missed alerts belong in the bell and report, not a blocking dialog.
      const cutoff = new Date(Date.now() - 120000).toISOString();
      const { data: ringing, error: callError } = await supabase.from("calls")
        .select("id").eq("tenant_id", tenantId).eq("direction", "inbound")
        .eq("status", "ringing").is("answered_at", null).gte("started_at", cutoff);
      if (callError) throw callError;
      if (!ringing?.length) return null;
      const { data, error } = await supabase.from("notifications")
        .select("id,title,body,type,data,created_at")
        .eq("tenant_id", tenantId).eq("user_id", userId)
        .eq("type", "inbound_call").is("read_at", null).gte("created_at", cutoff)
        .in("data->>call_id", ringing.map(row => row.id))
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

  useEffect(() => {
    if (voice.state === "connected" || voice.state === "connecting") audio.current?.stop();
    if (voice.state === "ringing" && audible && !call) {
      audio.current?.stop(); audio.current = playIncomingAlert(true);
      return () => audio.current?.stop();
    }
  }, [voice.state, audible, call?.id]);

  if (!call && !voice.call) return null;
  const details = (call?.data ?? {}) as Record<string, unknown>;
  const browserId = voice.call?.customParameters.get("WalixCallId");
  const matching = !voice.call || details.call_id === browserId;
  const name = matching && typeof details.caller_name === "string" ? details.caller_name : voice.call?.customParameters.get("CallerNumber") ?? call?.title.replace(/^Llamada entrante(?: no atendida)?: /, "") ?? "Llamada entrante";
  const phone = voice.call?.customParameters.get("CallerNumber") ?? (typeof details.from_number === "string" ? details.from_number : call?.body?.split("Número: ")[1] ?? "Número no disponible");
  const missed = !voice.call && call?.type === "missed_inbound_call";
  const connected = voice.state === "connected";
  const act = async (openReport: boolean) => {
    audio.current?.stop();
    if (!call) { if (openReport) navigate("/llamadas"); return; }
    setBusy(true);
    const callId = details.call_id;
    const update = supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("tenant_id", tenantId ?? "").eq("user_id", userId ?? "")
      .in("type", ["inbound_call", "missed_inbound_call"]);
    const { error } = await (typeof callId === "string"
      ? update.eq("data->>call_id", callId)
      : update.eq("id", call.id));
    setBusy(false);
    if (error) { toast.error("No se pudo cerrar el aviso"); return; }
    await qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (openReport) navigate("/llamadas");
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy && !voice.call) void act(false); }}>
      <DialogContent className={`z-[110] max-w-md max-h-[90dvh] overflow-y-auto border-success bg-success text-success-foreground text-center [&>button]:text-success-foreground ${voice.call ? "[&>button.absolute]:hidden" : ""}`} onEscapeKeyDown={e => { if (voice.call) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
        <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-success-foreground/40 motion-safe:animate-pulse">
          <PhoneIncoming className="h-8 w-8" />
        </div>
        <DialogTitle className="text-center text-xl tracking-normal">{connected ? "Llamada en curso" : missed ? "Llamada entrante no atendida" : "Llamada entrante"}</DialogTitle>
        <DialogDescription className="text-success-foreground text-center">
          {connected ? `${String(Math.floor(voice.seconds / 60)).padStart(2, "0")}:${String(voice.seconds % 60).padStart(2, "0")}` : missed ? "Registrada para devolver la llamada" : voice.state === "connecting" ? "Conectando…" : "Walix"}
        </DialogDescription>
        <div className="space-y-2 min-w-0">
          <p className="font-semibold text-lg break-words">{name}</p>
          {phone !== name && <p className="text-lg break-words">{phone}</p>}
          {matching && <p className="text-sm">{details.contact_id ? details.unassigned ? "Contacto sin asesor asignado" : "Contacto registrado" : "Número sin contacto registrado"}</p>}
          {call && matching && <p className="text-sm">{new Date(call.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</p>}
        </div>
        {voice.call && <div className="space-y-3">
          <div className="flex justify-center gap-3">
            {voice.state === "ringing" && <Button variant="secondary" onClick={() => { audio.current?.stop(); void voice.accept(); }}><Phone className="mr-2 h-4 w-4" />Contestar en Walix</Button>}
            {voice.state === "connecting" && <Button variant="secondary" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conectando</Button>}
            {connected && <Button variant="secondary" size="icon" title={voice.muted ? "Activar micrófono" : "Silenciar micrófono"} aria-label={voice.muted ? "Activar micrófono" : "Silenciar micrófono"} onClick={voice.toggleMute}>{voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>}
            <Button variant="destructive" disabled={voice.state === "connecting"} onClick={() => { voice.end(); void act(false); }}><PhoneOff className="mr-2 h-4 w-4" />{voice.state === "ringing" ? "Rechazar" : "Colgar"}</Button>
          </div>
          {connected && <div className="rounded-md bg-background p-3 text-foreground text-left"><CallAudioControls selection={selection} onChange={setSelection} audio={voice.audio} /></div>}
        </div>}
        {!voice.call && !missed && voice.error && <div role="alert"><p className="text-sm">{voice.error}</p><Button variant="secondary" onClick={voice.reconnect}>Reintentar recepción en Walix</Button></div>}
        {!connected && <>
        <Button variant="outline" className="bg-transparent text-success-foreground border-success-foreground/50 hover:bg-success-foreground/15 hover:text-success-foreground" onClick={async () => {
          const enabled = await unlockIncomingAudio(); setAudible(enabled);
          if (!enabled) toast.error("El navegador no permitió el sonido");
          else { if (call) sounded.current.add(call.id); audio.current?.stop(); audio.current = playIncomingAlert(!missed); }
        }}><Volume2 className="h-4 w-4 mr-2" /> {audible ? "Probar sonido" : "Activar sonido"}</Button>
      {!voice.call && <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="bg-transparent text-success-foreground border-success-foreground/50 hover:bg-success-foreground/15 hover:text-success-foreground" disabled={busy} onClick={() => act(false)}>
          <X className="h-4 w-4 mr-1" /> Cerrar aviso
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => act(true)}>
          <ArrowUpRight className="h-4 w-4 mr-1" /> Ver llamadas
        </Button>
      </div>}
      </>}
      </DialogContent>
    </Dialog>
  );
}
