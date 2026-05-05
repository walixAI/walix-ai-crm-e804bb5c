import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function normalize(p: string) {
  return (p || "").replace(/[^\d]/g, "");
}

interface Props {
  open: boolean;
  onClose: () => void;
  channelId: string;
  channelPhone?: string | null;
  defaultExpectedPhone?: string;
}

type Phase = "form" | "waiting" | "success" | "timeout" | "wrong_sender";

const TIMEOUT_SECONDS = 120;
const POLL_MS = 3000;

export function LiveTestDialog({ open, onClose, channelId, channelPhone, defaultExpectedPhone }: Props) {
  const { toast } = useToast();
  const [expected, setExpected] = useState(defaultExpectedPhone ?? "");
  const [phase, setPhase] = useState<Phase>("form");
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);
  const [receivedFrom, setReceivedFrom] = useState<string | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("form");
      setSecondsLeft(TIMEOUT_SECONDS);
      setReceivedFrom(null);
      startedAtRef.current = null;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (pollRef.current) window.clearInterval(pollRef.current);
    }
  }, [open]);

  function stopTimers() {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function startTest() {
    const norm = normalize(expected);
    if (norm.length < 10) {
      toast({ title: "Número inválido", description: "Ingresa un número en formato internacional (ej. +52 55 1234 5678).", variant: "destructive" });
      return;
    }
    startedAtRef.current = new Date().toISOString();
    setPhase("waiting");
    setSecondsLeft(TIMEOUT_SECONDS);
    setReceivedFrom(null);

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopTimers();
          setPhase((p) => (p === "success" ? p : "timeout"));
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase
        .from("whatsapp_channels")
        .select("last_inbound_at, last_inbound_from")
        .eq("id", channelId)
        .maybeSingle();
      if (!data?.last_inbound_at) return;
      if (startedAtRef.current && data.last_inbound_at > startedAtRef.current) {
        const got = normalize(data.last_inbound_from ?? "");
        setReceivedFrom(data.last_inbound_from ?? "");
        if (got === norm || got.endsWith(norm) || norm.endsWith(got)) {
          stopTimers();
          setPhase("success");
        } else {
          setPhase("wrong_sender");
        }
      }
    }, POLL_MS);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Probar conexión en vivo</DialogTitle>
          <DialogDescription>
            Envía un WhatsApp real al número configurado para confirmar que el webhook recibe mensajes.
          </DialogDescription>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-3">
            {channelPhone && (
              <div className="text-sm">
                <span className="text-muted-foreground">Número de tu WhatsApp Business: </span>
                <span className="font-mono">{channelPhone}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Tu número personal (desde el que enviarás el mensaje)</Label>
              <Input value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="+52 55 1234 5678" />
            </div>
            <p className="text-xs text-muted-foreground">
              Al iniciar, abre WhatsApp y envía cualquier mensaje al número de arriba. Tienes 2 minutos.
            </p>
          </div>
        )}

        {phase === "waiting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-center">
              Esperando un mensaje desde <span className="font-mono">{expected}</span>…
            </div>
            <div className="text-xs text-muted-foreground">{secondsLeft}s restantes</div>
          </div>
        )}

        {phase === "wrong_sender" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                Recibimos un mensaje, pero proviene de <span className="font-mono">+{receivedFrom}</span>, no del número esperado.
                Seguimos esperando uno desde <span className="font-mono">{expected}</span> ({secondsLeft}s).
              </div>
            </div>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="font-medium">¡Conexión verificada!</div>
            <div className="text-sm text-muted-foreground">
              Recibimos tu mensaje desde <span className="font-mono">+{receivedFrom}</span>.
            </div>
          </div>
        )}

        {phase === "timeout" && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">No recibimos ningún mensaje en 2 minutos.</span>
            </div>
            <p className="text-muted-foreground">Verifica en Meta Business Manager:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-0.5 text-xs">
              <li>El Webhook URL está configurado y verificado.</li>
              <li>El Verify Token coincide exactamente con el de Walix.</li>
              <li>Está suscrito al campo <span className="font-mono">messages</span>.</li>
              <li>El número no está en modo sandbox o requiere agregar tu número como tester.</li>
            </ul>
          </div>
        )}

        <DialogFooter>
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={startTest}>Iniciar prueba</Button>
            </>
          )}
          {(phase === "waiting" || phase === "wrong_sender") && (
            <Button variant="outline" onClick={() => { stopTimers(); onClose(); }}>Cancelar</Button>
          )}
          {(phase === "success" || phase === "timeout") && (
            <>
              {phase === "timeout" && (
                <Button variant="outline" onClick={() => { setPhase("form"); setSecondsLeft(TIMEOUT_SECONDS); }}>
                  Reintentar
                </Button>
              )}
              <Button onClick={onClose}>Cerrar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}