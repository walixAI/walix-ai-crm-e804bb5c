import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2, Monitor, Headphones, ArrowUpRight, LockKeyhole, UserRound, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Device, type Call } from "@twilio/voice-sdk";
import { LogFollowUpDialog } from "@/components/activity/LogFollowUpDialog";
import { usePhoneCallPermissions } from "@/lib/queries/phoneCallPermissions";
import { isEffectiveCall } from "@/lib/activities/consolidateCalls";
import { CallTranscript } from "./CallTranscript";
import { CallAudioControls, applyCallAudio, type AudioSelection } from "./CallAudioControls";

type CallState = "idle" | "starting" | "ringing" | "ending" | "failed";

async function callError(data: { error?: string } | null, error: unknown) {
  if (typeof data?.error === "string" && data.error) return data.error;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.clone().json();
      if (typeof body?.error === "string" && body.error) return body.error;
    } catch { /* La respuesta puede no contener JSON. */ }
  }
  return "No se pudo iniciar la llamada. Intenta de nuevo o pide ayuda a un administrador.";
}

const OUTCOMES = [
  { value: "completed", label: "Contestó" },
  { value: "no_answer", label: "No contestó" },
  { value: "busy", label: "Ocupado" },
  { value: "voicemail", label: "Buzón de voz" },
  { value: "failed", label: "Falló" },
];

/** Cómo se describe un intento que no llegó a una conversación. */
const ATTEMPT_LABEL: Record<string, string> = {
  queued: "no llegó a marcar",
  ringing: "no contestó a tiempo",
  no_answer: "sin respuesta",
  busy: "línea ocupada",
  voicemail: "buzón de voz",
  failed: "falló",
};

interface Props {
  contactId?: string;
  phone?: string | null;
  contactName?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function CallButton({ contactId, phone, contactName, size = "sm", variant = "outline" }: Props) {
  const [mode, setMode] = useState<"phone" | "browser">("phone");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState(false);
  const [audioSelection, setAudioSelection] = useState<AudioSelection>({ input: "default", output: "default" });
  const permissions = usePhoneCallPermissions(chooserOpen);
  const [provider, setProvider] = useState("");
  const [callStatus, setCallStatus] = useState("queued");
  const [summary, setSummary] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [transcript, setTranscript] = useState("");
  const [suggestedOutcome, setSuggestedOutcome] = useState<string | null>(null);
  const [dealId, setDealId] = useState<string | null>(null);
  const device = useRef<Device | null>(null);
  const browserCall = useRef<Call | null>(null);
  const [open, setOpen] = useState(false);
  const [hungUp, setHungUp] = useState(false);
  const [state, setState] = useState<CallState>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState("");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state === "ringing" && (provider !== "twilio" || callStatus === "answered")) {
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [state, provider, callStatus]);

  useEffect(() => () => { browserCall.current?.disconnect(); device.current?.destroy(); }, []);

  useEffect(() => {
    if (!callId || provider !== "twilio" || !open) return;
    let cancelled = false;
    const poll = async () => {
      const { data, error } = await supabase.functions.invoke("telephony-api", { body: { action: "status", call_id: callId } });
      if (cancelled || error || !data?.call) return;
      const row = data.call;
      setCallStatus(row.status); setSummary(row.ai_summary ?? ""); setTranscriptionStatus(row.ai_suggestions?.transcription_status ?? "");
      setTranscript(row.transcript ?? "");
      setSuggestedOutcome(row.ai_suggestions?.outcome_id ?? null); setDealId(row.deal_id ?? null);
      if (row.duration_seconds != null) setSeconds(row.duration_seconds);
    };
    void poll();
    const interval = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [callId, provider, open]);

  const reset = () => {
    browserCall.current?.disconnect(); device.current?.destroy(); browserCall.current = null; device.current = null;
    setState("idle"); setCallId(null); setSeconds(0); setNotes(""); setFailure(""); setSummary(""); setCallStatus("queued");
    setTranscript(""); setTranscriptionStatus("");
    if (timer.current) clearInterval(timer.current);
  };

  const start = async (selectedMode: "phone" | "browser" = mode) => {
    setMode(selectedMode);
    if (!phone) { toast.error("Este contacto no tiene número de teléfono"); return; }
    setOpen(true); setState("starting");
    try {
    if (selectedMode === "browser") {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getTracks().forEach((track) => track.stop());
    }
    const { data, error } = await supabase.functions.invoke("telephony-api", {
      body: { action: "start", contact_id: contactId, to_number: phone, mode: selectedMode },
    });
    const dialTel = () => { window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`; };
    if (error || !data?.ok) {
      const message = await callError(data, error);
      setFailure(message); setState("failed"); toast.error(message);
      return;
    }
    // Canal simulado: no sale ninguna llamada real, se marca desde el dispositivo y se registra el resultado
    if (data.provider === "simulated") dialTel();
    setCallId(data.call.id); setProvider(data.provider); setCallStatus("queued");
    if (selectedMode === "browser" && data.token) {
      device.current = new Device(data.token, { closeProtection: true });
      device.current.on("error", () => { setFailure("No se pudo conectar el audio de la computadora"); setState("failed"); });
      if (device.current.audio) {
        try { await applyCallAudio(device.current.audio, audioSelection); }
        catch { toast.error("No se pudo usar el audio seleccionado. Se usará el predeterminado; puedes cambiarlo durante la llamada."); }
      }
      browserCall.current = await device.current.connect({ params: { WalixCallId: data.call.id } });
      browserCall.current.on("error", () => { setFailure("La conexión de audio se interrumpió"); setState("failed"); });
    }
    setState("ringing");
    } catch (error) {
      const message = await callError(null, error);
      setFailure(message); setState("failed"); toast.error(message);
    }
  };

  const end = async (status: string) => {
    if (!callId) return;
    setState("ending");
    try {
    const { data, error } = await supabase.functions.invoke("telephony-api", {
      body: {
        action: "end", call_id: callId, status,
        duration_seconds: status === "completed" ? seconds : null,
        outcome: OUTCOMES.find((o) => o.value === status)?.label ?? null,
        notes: notes.trim() || null,
      },
    });
    if (error || !data?.ok) {
      toast.error(data?.error ?? "No se pudo registrar el resultado. Tus notas se conservaron; intenta de nuevo.");
      setState("ringing"); return;
    }
    toast.success("Resultado de llamada registrado");
    setOpen(false); reset();
    } catch {
      toast.error("No se pudo registrar el resultado. Tus notas se conservaron; intenta de nuevo.");
      setState("ringing");
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  /** ¿Hubo conversación real? Un intento no conectado no se tipifica. */
  const effective = isEffectiveCall({ status: callStatus, duration: seconds }, summary);

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setChooserOpen(true)} disabled={!phone || state === "starting" || state === "ringing" || state === "ending"} title={phone ? `Llamar a ${phone}` : "Sin teléfono"}>
        <Phone className="h-4 w-4" />
        {size !== "icon" && <span className="ml-1.5">Llamar</span>}
      </Button>

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="walix-dialer sm:max-w-[420px] max-h-[85dvh] overflow-y-auto p-0 gap-0 rounded-lg">
          <DialogHeader className="dialer-topbar px-6 py-4 pr-12 text-left">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-foreground/15"><Phone className="h-5 w-5" /></div>
              <div><DialogTitle className="text-base tracking-normal">Walix Marcador</DialogTitle><DialogDescription className="mt-1 text-xs text-primary-foreground/80">Nueva llamada</DialogDescription></div>
            </div>
          </DialogHeader>
          <div className="dialer-contact flex flex-col items-center gap-3 px-6 pb-5 pt-4 text-center">
            <div className="dialer-avatar grid h-20 w-20 shrink-0 place-items-center rounded-full [&>svg]:h-10 [&>svg]:w-10"><UserRound className="h-5 w-5" /></div>
            <div className="min-w-0 w-full"><p className="font-semibold text-xl break-words">{contactName ?? "Contacto"}</p><p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{phone}</p></div>
          </div>
          <div className="grid gap-3 px-6 pb-6">
            <h3 className="text-sm font-semibold">¿Cómo quieres llamar?</h3>
            <Button variant="outline" className="dialer-option group h-auto min-h-24 w-full justify-start gap-4 whitespace-normal p-4 text-left" onClick={() => { setChooserOpen(false); void start("browser"); }}>
              <span className="dialer-option-icon grid h-12 w-12 shrink-0 place-items-center rounded-full"><Monitor /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">Computadora / dispositivo</span><span className="mt-1 flex items-center gap-1.5 text-xs font-normal text-muted-foreground"><Headphones className="h-3.5 w-3.5" />Micrófono y audífonos</span></span>
              <ArrowUpRight className="text-muted-foreground group-hover:text-primary" />
            </Button>
            <Button variant="outline" disabled={!permissions.data?.can_use_phone || permissions.isFetching} className="dialer-option group h-auto min-h-24 w-full justify-start gap-4 whitespace-normal p-4 text-left" onClick={() => { setChooserOpen(false); void start("phone"); }}>
              <span className="dialer-option-icon grid h-12 w-12 shrink-0 place-items-center rounded-full"><Phone /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">Mi celular</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{permissions.isFetching ? "Consultando autorización…" : permissions.isError ? "No se pudo verificar tu permiso" : permissions.data?.can_use_phone ? "Recibes la llamada en tu celular personal" : "Requiere autorización de un administrador o propietario"}</span></span>
              {permissions.isFetching ? <Loader2 className="animate-spin text-muted-foreground" /> : permissions.data?.can_use_phone ? <ArrowUpRight className="text-muted-foreground group-hover:text-primary" /> : <LockKeyhole className="text-muted-foreground" />}
            </Button>
            {permissions.isError && <Button variant="ghost" size="sm" onClick={() => void permissions.refetch()}>Reintentar autorización</Button>}
            <Button variant="outline" size="sm" onClick={() => setAudioSettings(!audioSettings)}><Headphones className="mr-2 h-4 w-4" />{audioSettings ? "Ocultar audio" : "Configurar audio del dispositivo"}</Button>
            {audioSettings && <CallAudioControls selection={audioSelection} onChange={setAudioSelection} />}
          </div>
          <div className="dialer-footer flex items-center justify-center gap-2 px-5 py-3 text-xs"><Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />Seguimiento de la llamada</div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(v) => { if (!v && state === "ringing" && !hungUp && !["completed", "failed", "no_answer", "busy", "voicemail"].includes(callStatus)) return; if (!v) setHungUp(false); setOpen(v); if (!v) reset(); }}>
        <DialogContent className="walix-dialer dialer-active flex flex-col sm:max-w-[420px] max-h-[calc(100dvh-2rem)] overflow-hidden p-0 gap-0 rounded-lg">
          <DialogHeader className="dialer-active-header shrink-0 items-center px-6 pb-0 pt-6 text-center sm:text-center">
            <p className="dialer-eyebrow mb-5 text-xs font-medium">Walix Marcador</p>
            <div className="dialer-avatar mb-4 grid h-20 w-20 shrink-0 place-items-center rounded-full"><UserRound className="h-10 w-10" /></div>
            <DialogTitle className="w-full text-2xl leading-tight tracking-normal break-words">{contactName ?? "Contacto"}</DialogTitle>
            <DialogDescription className="mt-2 text-sm tabular-nums">{phone}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-4 pt-3">
          {state === "starting" && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Iniciando llamada…
            </div>
          )}

          {state === "failed" && (
            <div className="space-y-4">
              <p role="alert" className="text-sm text-destructive">{failure}</p>
              <p className="text-sm text-muted-foreground">No se confirmó ninguna llamada ni se registró un resultado. El marcador del dispositivo requiere una aplicación de llamadas instalada.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void start(mode)}>Reintentar</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (phone) window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
                }}><Phone className="h-4 w-4 mr-1" />Abrir marcador</Button>
                {contactId && <Button size="sm" variant="outline" onClick={() => { setOpen(false); setFollowUpOpen(true); }}>Registrar seguimiento</Button>}
              </div>
            </div>
          )}

          {state === "ringing" && (
            <div className="space-y-4">
              <div className="text-center pb-5 pt-2">
                <div className="text-4xl font-light tabular-nums min-h-10">{mm}:{ss}</div>
                <p className="text-sm text-muted-foreground mt-1">{provider === "twilio" ? ({ queued: mode === "phone" ? "Llamando a tu celular" : "Conectando audio", ringing: "Marcando al contacto", answered: "Contacto conectado", completed: "Llamada terminada", failed: "Falló", no_answer: "Sin respuesta", busy: "Ocupado", voicemail: "Buzón de voz" }[callStatus] ?? "Esperando estado") : "Llamada en curso"}</p>
                <p className="mt-3 inline-flex items-center justify-center gap-2 text-xs text-muted-foreground">{mode === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}{mode === "phone" ? "Audio en tu celular" : "Audio en la computadora"}</p>
              </div>
              {mode === "browser" && !hungUp && !["completed", "failed", "no_answer", "busy", "voicemail"].includes(callStatus) && <CallAudioControls selection={audioSelection} onChange={setAudioSelection} audio={device.current?.audio} />}
              {mode === "phone" && <p className="flex items-start gap-2 text-xs text-muted-foreground"><Phone className="mt-0.5 h-4 w-4 shrink-0" />Elige teléfono, altavoz o Bluetooth en la pantalla de llamada de tu celular.</p>}
              <Textarea
                className="dialer-notes resize-none" aria-label="Notas de la llamada"
                placeholder="Notas de la llamada (opcional)…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              {provider === "twilio" ? <div className="space-y-3 [&>button]:w-full">
                {["completed", "failed", "no_answer", "busy", "voicemail"].includes(callStatus) ? (effective ? <>
                  <p className="text-sm">Llamada efectiva registrada.</p>
                  <CallTranscript status={transcriptionStatus} transcript={transcript} summary={summary} />
                  {contactId && <Button onClick={() => { setOpen(false); setFollowUpOpen(true); }}>Tipificar y registrar seguimiento</Button>}
                  <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cerrar</Button>
                </> : <>
                  <p className="text-sm">Intento registrado: {ATTEMPT_LABEL[callStatus] ?? "no conectado"}.</p>
                  <p className="text-xs text-muted-foreground">No hubo conversación, así que no se tipifica. Programa el reintento cuando quieras.</p>
                  {contactId && <Button onClick={() => { setOpen(false); setFollowUpOpen(true); }}>Programar reintento</Button>}
                  <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cerrar</Button>
                </>) : hungUp ? (effective ? <>
                  <p className="text-sm text-muted-foreground">Llamada colgada. El resultado automático se registrará en cuanto Twilio lo confirme.</p>
                  {contactId && <Button onClick={() => { setOpen(false); setHungUp(false); setFollowUpOpen(true); }}>Tipificar y registrar seguimiento</Button>}
                  <Button variant="outline" onClick={() => { setOpen(false); setHungUp(false); reset(); }}>Cerrar</Button>
                </> : <>
                  <p className="text-sm text-muted-foreground">Llamada colgada sin conversación. El intento se registrará en cuanto Twilio lo confirme.</p>
                  {contactId && <Button onClick={() => { setOpen(false); setHungUp(false); setFollowUpOpen(true); }}>Programar reintento</Button>}
                  <Button variant="outline" onClick={() => { setOpen(false); setHungUp(false); reset(); }}>Cerrar</Button>
                </>) : null}
              </div> : <><p className="text-xs text-muted-foreground">Al terminar, marca el resultado:</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map((o) => (
                  <Button key={o.value} variant={o.value === "completed" ? "default" : "outline"} size="sm" onClick={() => end(o.value)}>
                    {o.value === "completed" ? <Phone className="h-3.5 w-3.5 mr-1" /> : <PhoneOff className="h-3.5 w-3.5 mr-1" />}
                    {o.label}
                  </Button>
                ))}
              </div></>}
            </div>
          )}

          {state === "ending" && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Guardando…
            </div>
          )}
          </div>
          {state === "ringing" && provider === "twilio" && !hungUp && !["completed", "failed", "no_answer", "busy", "voicemail"].includes(callStatus) && <div className="dialer-footer shrink-0 flex flex-col items-center gap-1 px-6 py-3">
            <Button variant="destructive" size="icon" className="dialer-hangup h-14 w-14 rounded-full [&_svg]:h-6 [&_svg]:w-6" aria-label="Colgar" title="Colgar" onClick={async () => {
              browserCall.current?.disconnect();
              setHungUp(true);
              const { data, error } = await supabase.functions.invoke("telephony-api", { body: { action: "end", call_id: callId } });
              if (error || !data?.ok) toast.error(await callError(data, error));
            }}><PhoneOff /></Button><span className="text-xs text-muted-foreground">Colgar</span>
          </div>}
        </DialogContent>
      </Dialog>
      {contactId && followUpOpen && <LogFollowUpDialog
        open={followUpOpen}
        onOpenChange={(value) => { setFollowUpOpen(value); if (!value) reset(); }}
        contactId={contactId}
        callId={callId}
        callMode={effective ? "effective" : "attempt"}
        dealId={dealId}
        initialOutcomeId={suggestedOutcome}
        allowDealPicker
        initialDescription={failure ? `No se pudo iniciar la llamada desde Walix: ${failure}. ${notes}`.trim() : `${summary} ${notes}`.trim()}
      />}
    </>
  );
}
