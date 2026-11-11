import { installAiUsageTracking } from "../_shared/ai-track.ts";
installAiUsageTracking("call_analyzer");
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { routeInboundCall } from "../_shared/telephony-routing.ts";
import { analyzeCall } from "../_shared/call-analyzer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Webhook de eventos del proveedor (Telnyx/Twilio). Actualiza el estado de la llamada.
// Twilio entrega formularios codificados; Telnyx entrega JSON.

async function readPayload(req: Request): Promise<Record<string, any>> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData().catch(() => null);
    const out: Record<string, string> = {};
    form?.forEach((value, key) => { out[key] = String(value); });
    return out;
  }
  return await req.json().catch(() => ({}));
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Estados que reporta cada proveedor sobre la misma llamada.
const STATUS_MAP: Record<string, string> = {
  // Telnyx v2
  "call.initiated": "queued",
  "call.ringing": "ringing",
  "call.answered": "answered",
  "call.hangup": "completed",
  "call.machine.detection.ended": "voicemail",
  // Twilio (CallStatus)
  queued: "queued",
  ringing: "ringing",
  "in-progress": "answered",
  completed: "completed",
  busy: "busy",
  "no-answer": "no_answer",
  canceled: "no_answer",
  failed: "failed",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // El callback debe traer el token del canal: sin él no se modifica ninguna llamada.
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? req.headers.get("x-walix-webhook-token");
    if (!token) return ok({ ok: true, ignored: true });

    const { data: channel } = await admin.from("call_channels")
      .select("id, tenant_id, phone_number, pbx_config, provider")
      .eq("webhook_token", token).maybeSingle();
    if (!channel) return ok({ ok: true, ignored: true }, 401);

    const payload = await readPayload(req);

    // Formato Telnyx v2: data.event_type, data.payload.call_control_id
    const eventType: string | undefined = payload?.data?.event_type ?? payload?.event_type;
    const p = payload?.data?.payload ?? payload ?? {};
    const providerCallId: string | undefined = p.call_control_id ?? p.CallSid;
    if (!providerCallId) return ok({ ok: true, ignored: true });

    // Llamada entrante nueva: enrutar por PBX
    const isInbound = (eventType === "call.initiated" && p.direction === "incoming") ||
      (String(p.Direction ?? "").toLowerCase() === "inbound" && !!p.CallStatus);
    if (isInbound) {
      const { data: existing } = await admin.from("calls").select("id").eq("provider_call_id", providerCallId).maybeSingle();
      if (!existing) {
        const toNum = String(p.to ?? p.To ?? "").replace(/\D/g, "").slice(-10);
        const channelLast10 = String(channel.phone_number ?? "").replace(/\D/g, "").slice(-10);
        if (toNum && toNum === channelLast10) {
          const r = await routeInboundCall(admin, {
            channel,
            fromNumber: String(p.from ?? p.From ?? ""),
            digit: p.Digits ?? null,
            providerCallId,
          });
          return ok({ ok: true, routed: r.target });
        }
      }
    }

    const rawStatus: string | undefined = eventType ?? p.CallStatus ?? p.call_status;
    const status = rawStatus ? STATUS_MAP[rawStatus] : undefined;

    // Aviso de grabación: Twilio lo publica en la misma URL con RecordingSid/RecordingUrl.
    if (p.RecordingSid && p.RecordingUrl) {
      await admin.from("calls").update({ recording_url: String(p.RecordingUrl) })
        .eq("provider_call_id", providerCallId).is("ended_at", null);
    }

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (status === "answered") update.answered_at = new Date().toISOString();
    if (status === "completed" || status === "busy" || status === "no_answer" || status === "failed" || status === "voicemail") {
      update.ended_at = new Date().toISOString();
      const secs = Number(p.call_leg_duration_secs ?? p.Duration);
      if (Number.isFinite(secs)) update.duration_seconds = secs;
    }
    if (p.recording_urls?.[0]?.mp3) update.recording_url = p.recording_urls[0].mp3;

    if (Object.keys(update).length > 0) {
      // No pisar una llamada que el asesor ya cerró desde Walix.
      await admin.from("calls").update(update)
        .eq("provider_call_id", providerCallId).is("ended_at", null);
    }

    // Transcripción entregada por el proveedor (Telnyx/Twilio): guardar y analizar con IA.
    const transcriptText: string | undefined = p.transcription_text ?? p.TranscriptionText;
    if (transcriptText && String(transcriptText).trim().length >= 20) {
      const { data: callRow } = await admin.from("calls").select("id, ai_summary").eq("provider_call_id", providerCallId).maybeSingle();
      if (callRow && !callRow.ai_summary) {
        await admin.from("calls").update({ transcript: String(transcriptText).slice(0, 20000) }).eq("id", callRow.id);
        const r = await analyzeCall(admin, callRow.id);
        if (!r.ok) console.error("call analysis failed:", r.status, r.error);
      }
    }

    return ok({ ok: true });
  } catch (e) {
    console.error("telephony-webhook error:", e);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
