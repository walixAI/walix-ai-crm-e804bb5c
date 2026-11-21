import { useEffect, useRef, useState } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useIncomingBrowserCall(tenantId?: string | null, userId?: string) {
  const devices = useRef(new Map<string, Device>());
  const current = useRef<Call | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [state, setState] = useState<"idle" | "ringing" | "connecting" | "connected">("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!tenantId || !userId) return;
    let disposed = false;
    let refreshing = false;
    const clearCall = (incoming: Call) => {
      if (current.current !== incoming) return;
      current.current = null; setCall(null); setState("idle"); setMuted(false); setSeconds(0);
    };
    const refresh = async () => {
      if (disposed || refreshing) return;
      refreshing = true;
      try {
        const { data, error: failure } = await supabase.functions.invoke("telephony-api", { body: { action: "inbound_browser_token" } });
        if (disposed) return;
        if (failure || !data?.ok) throw new Error("No se pudo habilitar la recepción en Walix");
        const tokens = data.tokens as { channel_id: string; token: string }[];
        const ids = new Set(tokens.map(t => t.channel_id));
        for (const [id, device] of devices.current) {
          if (!ids.has(id)) { device.destroy(); devices.current.delete(id); }
        }
        for (const item of tokens) {
          const existing = devices.current.get(item.channel_id);
          if (existing) {
            existing.updateToken(item.token);
            if (existing.state === Device.State.Unregistered) await existing.register();
            continue;
          }
          const device = new Device(item.token, { closeProtection: true, tokenRefreshMs: 20000 });
          devices.current.set(item.channel_id, device);
          device.on("tokenWillExpire", () => { void refresh(); });
          device.on("error", () => setError("Se interrumpió la recepción en Walix"));
          device.on("incoming", (incoming: Call) => {
            if (disposed || current.current) { incoming.reject(); return; }
            current.current = incoming; setCall(incoming); setState("ringing"); setError("");
            incoming.on("accept", () => { if (current.current === incoming) setState("connected"); });
            for (const event of ["cancel", "disconnect", "reject"] as const) incoming.on(event, () => clearCall(incoming));
            incoming.on("error", () => { clearCall(incoming); toast.error("La llamada se interrumpió"); });
          });
          await device.register();
          if (disposed) { device.destroy(); return; }
        }
        setError("");
      } catch (failure) {
        if (!disposed) {
          setError(failure instanceof Error ? failure.message : "No se pudo habilitar la recepción en Walix");
          // Destroy failed registrations so the next refresh can retry them.
          for (const [id, device] of devices.current) {
            if (device.state !== Device.State.Registered) { device.destroy(); devices.current.delete(id); }
          }
        }
      } finally { refreshing = false; }
    };
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 60000);
    return () => {
      disposed = true; clearInterval(interval);
      current.current?.disconnect(); current.current?.reject(); current.current = null;
      devices.current.forEach(device => device.destroy()); devices.current.clear();
      setCall(null); setState("idle"); setSeconds(0); setMuted(false);
    };
  }, [tenantId, userId, retry]);

  useEffect(() => {
    if (state !== "connected") return;
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  const accept = async () => {
    const incoming = current.current;
    if (!incoming || state !== "ringing") return;
    setState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      if (current.current !== incoming) return;
      incoming.accept();
    } catch {
      if (current.current === incoming) setState("ringing");
      toast.error("Permite el micrófono para contestar en Walix");
    }
  };
  const end = async () => {
    const incoming = current.current;
    if (!incoming) return;
    if (state === "ringing") { incoming.reject(); return; }
    const callId = incoming.customParameters.get("WalixCallId");
    if (callId) {
      try {
        const { data, error } = await supabase.functions.invoke("telephony-api", { body: { action: "end", call_id: callId } });
        if (error || !data?.ok) { toast.error("No se pudo colgar la llamada. Intenta de nuevo."); return; }
      } catch { toast.error("No se pudo colgar la llamada. Intenta de nuevo."); return; }
    }
    incoming.disconnect();
  };
  const toggleMute = () => { current.current?.mute(!muted); setMuted(!muted); };
  const device = call ? [...devices.current.values()].find(d => d.calls.includes(call)) : undefined;
  return { call, state, seconds, muted, error, accept, end, toggleMute, audio: device?.audio, reconnect: () => setRetry(r => r + 1) };
}