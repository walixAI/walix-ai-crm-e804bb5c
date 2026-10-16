import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getTelephonyProvider } from "../_shared/telephony-provider.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RedialRules = {
  max_attempts?: number;
  interval_hours?: number;
  action?: "redial" | "schedule";
};

const FINAL_OK = ["completed", "answered"];
const RETRYABLE = ["no_answer", "busy", "failed", "voicemail"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();

    // 1) Resolver contactos en estado "calling": revisar el estado real de la llamada
    const { data: inFlight } = await admin
      .from("call_campaign_contacts")
      .select("id, tenant_id, campaign_id, contact_id, attempts, last_call_id")
      .eq("status", "calling")
      .limit(200);

    let resolved = 0;
    for (const row of inFlight ?? []) {
      if (!row.last_call_id) continue;
      const { data: call } = await admin
        .from("calls")
        .select("id, status, ended_at")
        .eq("id", row.last_call_id)
        .maybeSingle();
      if (!call) continue;

      // Aún sonando/en curso: esperar (máx. 10 min por seguridad)
      if (["queued", "ringing", "answered"].includes(call.status)) continue;

      const { data: camp } = await admin
        .from("call_campaigns")
        .select("redial_rules")
        .eq("id", row.campaign_id)
        .maybeSingle();
      const rules: RedialRules = camp?.redial_rules ?? {};
      const maxAttempts = Math.max(1, rules.max_attempts ?? 3);
      const intervalH = Math.max(1, rules.interval_hours ?? 2);

      if (FINAL_OK.includes(call.status)) {
        await admin.from("call_campaign_contacts")
          .update({ status: "done" }).eq("id", row.id);
        resolved++;
        continue;
      }

      if (RETRYABLE.includes(call.status) && row.attempts < maxAttempts && (rules.action ?? "redial") === "redial") {
        const next = new Date(now.getTime() + intervalH * 3600_000);
        await admin.from("call_campaign_contacts")
          .update({ status: "pending", next_attempt_at: next.toISOString() }).eq("id", row.id);
      } else if (RETRYABLE.includes(call.status) && row.attempts < maxAttempts && rules.action === "schedule") {
        // Agendar para después: queda pendiente pero el asesor decide cuándo (sin hora automática)
        await admin.from("call_campaign_contacts")
          .update({ status: "pending", next_attempt_at: null }).eq("id", row.id);
      } else {
        await admin.from("call_campaign_contacts")
          .update({ status: "failed" }).eq("id", row.id);
      }
      resolved++;
    }

    // 2) Iniciar llamadas pendientes cuya hora ya llegó
    const { data: due } = await admin
      .from("call_campaign_contacts")
      .select("id, tenant_id, campaign_id, contact_id, attempts")
      .eq("status", "pending")
      .lte("next_attempt_at", now.toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(25);

    let started = 0;
    for (const row of due ?? []) {
      const { data: camp } = await admin
        .from("call_campaigns")
        .select("id, tenant_id, channel_id, status, schedule, redial_rules")
        .eq("id", row.campaign_id)
        .maybeSingle();
      if (!camp || camp.status !== "active") continue;

      // Horario permitido (schedule: { start_hour, end_hour } en hora local del tenant, simple)
      const sched = (camp.schedule ?? {}) as { start_hour?: number; end_hour?: number };
      const hour = now.getUTCHours();
      if (sched.start_hour != null && sched.end_hour != null) {
        if (hour < sched.start_hour || hour >= sched.end_hour) {
          // reprogramar al inicio del siguiente horario
          const next = new Date(now);
          next.setUTCHours(sched.start_hour, 0, 0, 0);
          if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
          await admin.from("call_campaign_contacts")
            .update({ next_attempt_at: next.toISOString() }).eq("id", row.id);
          continue;
        }
      }

      const { data: contact } = await admin
        .from("contacts")
        .select("id, tenant_id, phone, owner_id")
        .eq("id", row.contact_id)
        .maybeSingle();
      if (!contact?.phone || contact.tenant_id !== camp.tenant_id) {
        await admin.from("call_campaign_contacts")
          .update({ status: "skipped" }).eq("id", row.id);
        continue;
      }

      const { data: channel } = await admin
        .from("call_channels")
        .select("*")
        .eq("id", camp.channel_id)
        .eq("status", "active")
        .maybeSingle();
      if (!channel) {
        await admin.from("call_campaigns")
          .update({ status: "paused" }).eq("id", camp.id);
        continue;
      }

      const { data: deal } = await admin.from("deals")
        .select("id").eq("contact_id", contact.id).eq("tenant_id", camp.tenant_id)
        .neq("stage", "won").order("created_at", { ascending: false }).limit(1).maybeSingle();

      const provider = getTelephonyProvider({
        provider: channel.provider,
        phone_number: channel.phone_number,
        credentials: null,
      });
      const startedCall = await provider.startCall(contact.phone, channel.phone_number);

      const { data: call, error: insErr } = await admin.from("calls").insert({
        tenant_id: camp.tenant_id,
        channel_id: channel.id,
        contact_id: contact.id,
        deal_id: deal?.id ?? null,
        user_id: contact.owner_id ?? null,
        campaign_id: camp.id,
        direction: "outbound",
        from_number: channel.phone_number,
        to_number: contact.phone,
        status: startedCall.status,
        provider_call_id: startedCall.providerCallId,
        started_at: now.toISOString(),
      }).select("id").single();
      if (insErr) throw insErr;

      await admin.from("call_campaign_contacts")
        .update({ status: "calling", attempts: row.attempts + 1, last_call_id: call.id })
        .eq("id", row.id);
      started++;
    }

    // 3) Marcar campañas terminadas (sin pendientes ni en curso)
    const { data: activeCamps } = await admin
      .from("call_campaigns")
      .select("id")
      .eq("status", "active");
    for (const camp of activeCamps ?? []) {
      const { count } = await admin
        .from("call_campaign_contacts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", camp.id)
        .in("status", ["pending", "calling"]);
      if ((count ?? 0) === 0) {
        await admin.from("call_campaigns").update({ status: "finished" }).eq("id", camp.id);
      }
    }

    return json({ ok: true, resolved, started });
  } catch (e) {
    console.error("call-campaign-worker error:", e);
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});
