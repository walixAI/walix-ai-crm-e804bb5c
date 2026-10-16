import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { routeInboundCall } from "../_shared/telephony-routing.ts";
import { analyzeCall } from "../_shared/call-analyzer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Webhook de eventos del proveedor (Telnyx/Twilio). Actualiza el estado de la llamada.
// Más adelante: al llegar la grabación, dispara call-analyzer.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const payload = await req.json().catch(() => ({}));

    // Formato Telnyx v2: data.event_type, data.payload.call_control_id
    const eventType: string | undefined = payload?.data?.event_type ?? payload?.event_type;
    const p = payload?.data?.payload ?? payload ?? {};
    const providerCallId: string | undefined = p.call_control_id ?? p.CallSid;

    if (!providerCallId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Llamada entrante nueva: enrutar por PBX
    const isInbound = (eventType === "call.initiated" && p.direction === "incoming") || (p.Direction === "inbound" && p.CallStatus === "ringing");
    if (isInbound) {
      const { data: existing } = await admin.from("calls").select("id").eq("provider_call_id", providerCallId).maybeSingle();
      if (!existing) {
        const toNum = String(p.to ?? p.To ?? "").replace(/\D/g, "").slice(-10);
        const { data: channels } = await admin.from("call_channels").select("*").eq("status", "active");
        const channel = (channels ?? []).find((c: any) => String(c.phone_number ?? "").replace(/\D/g, "").slice(-10) === toNum);
        if (channel) {
          const r = await routeInboundCall(admin, { channel, fromNumber: String(p.from ?? p.From ?? ""), digit: p.Digits ?? null, providerCallId });
          return new Response(JSON.stringify({ ok: true, routed: r.target }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const statusMap: Record<string, string> = {
      "call.initiated": "queued",
      "call.ringing": "ringing",
      "call.answered": "answered",
      "call.hangup": "completed",
      "call.machine.detection.ended": "voicemail",
      Ringing: "ringing",
      Completed: "completed",
      Busy: "busy",
      NoAnswer: "no_answer",
      Failed: "failed",
    };
    const status = eventType ? statusMap[eventType] : undefined;

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (eventType === "call.answered") update.answered_at = new Date().toISOString();
    if (eventType === "call.hangup" || eventType === "Completed") {
      update.ended_at = new Date().toISOString();
      if (p.call_leg_duration_secs ?? p.Duration) {
        update.duration_seconds = Number(p.call_leg_duration_secs ?? p.Duration);
      }
    }
    if (p.recording_urls?.[0]?.mp3 || p.RecordingUrl) {
      update.recording_url = p.recording_urls?.[0]?.mp3 ?? p.RecordingUrl;
    }

    if (Object.keys(update).length > 0) {
      await admin.from("calls").update(update).eq("provider_call_id", providerCallId);
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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telephony-webhook error:", e);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
