import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CallState = "idle" | "starting" | "ringing" | "ending";

const OUTCOMES = [
  { value: "completed", label: "Contestó" },
  { value: "no_answer", label: "No contestó" },
  { value: "busy", label: "Ocupado" },
  { value: "voicemail", label: "Buzón de voz" },
  { value: "failed", label: "Falló" },
];

interface Props {
  contactId?: string;
  phone?: string | null;
  contactName?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function CallButton({ contactId, phone, contactName, size = "sm", variant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CallState>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state === "ringing") {
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [state]);

  const reset = () => {
    setState("idle"); setCallId(null); setSeconds(0); setNotes("");
    if (timer.current) clearInterval(timer.current);
  };

  const start = async () => {
    if (!phone) { toast.error("Este contacto no tiene número de teléfono"); return; }
    setOpen(true); setState("starting");
    const { data, error } = await supabase.functions.invoke("telephony-api", {
      body: { action: "start", contact_id: contactId, to_number: phone },
    });
    if (error || !data?.ok) {
      const msg = data?.error ?? error?.message ?? "No se pudo iniciar la llamada";
      toast.error(msg);
      setOpen(false); reset();
      return;
    }
    setCallId(data.call.id);
    setState("ringing");
  };

  const end = async (status: string) => {
    if (!callId) return;
    setState("ending");
    const { error } = await supabase.functions.invoke("telephony-api", {
      body: {
        action: "end", call_id: callId, status,
        duration_seconds: status === "completed" ? seconds : null,
        outcome: OUTCOMES.find((o) => o.value === status)?.label ?? null,
        notes: notes.trim() || null,
      },
    });
    if (error) toast.error("No se pudo registrar el resultado");
    else toast.success("Llamada registrada en la actividad del lead");
    setOpen(false); reset();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      <Button size={size} variant={variant} onClick={start} disabled={!phone} title={phone ? `Llamar a ${phone}` : "Sin teléfono"}>
        <Phone className="h-4 w-4" />
        {size !== "icon" && <span className="ml-1.5">Llamar</span>}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v && state === "ringing") return; setOpen(v); if (!v) reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Llamada a {contactName ?? phone}
            </DialogTitle>
            <DialogDescription>{phone}</DialogDescription>
          </DialogHeader>

          {state === "starting" && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Iniciando llamada…
            </div>
          )}

          {state === "ringing" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-3xl font-mono font-semibold tabular-nums">{mm}:{ss}</div>
                <p className="text-sm text-muted-foreground mt-1">Llamada en curso</p>
              </div>
              <Textarea
                placeholder="Notas de la llamada (opcional)…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Al terminar, marca el resultado:</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map((o) => (
                  <Button key={o.value} variant={o.value === "completed" ? "default" : "outline"} size="sm" onClick={() => end(o.value)}>
                    {o.value === "completed" ? <Phone className="h-3.5 w-3.5 mr-1" /> : <PhoneOff className="h-3.5 w-3.5 mr-1" />}
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {state === "ending" && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Guardando…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
