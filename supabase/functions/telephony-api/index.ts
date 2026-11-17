import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getTelephonyProvider } from "../_shared/telephony-provider.ts";
import { routeInboundCall } from "../_shared/telephony-routing.ts";
import { decryptCredentials, encryptCredentials } from "../_shared/telephony-creds.ts";
import twilio from "npm:twilio@5.10.4";
import { twilioRequest } from "../_shared/twilio-auth.ts";

const CRED_KEYS: Record<string, string[]> = {
  twilio: ["account_sid", "api_key_sid", "api_key_secret"],
  telnyx: ["api_key", "connection_id"],
};
const ADMIN_ROLES = ["tenant_admin", "tenant_owner", "sales_manager"];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Sesión inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await admin
      .from("profiles").select("tenant_id,active_tenant_id").eq("id", user.id).single();
    const tenantId = profile?.active_tenant_id ?? profile?.tenant_id;
    if (!tenantId) return json({ error: "Sin empresa asignada" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "browser_setup") {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
      if (!(roles ?? []).some((r: any) => ADMIN_ROLES.includes(r.role))) return json({ error: "Solo administradores pueden habilitar llamadas desde computadora" }, 403);
      const { data: channel } = await admin.from("call_channels").select("*").eq("id", body.channel_id).eq("tenant_id", tenantId).maybeSingle();
      if (!channel || channel.provider !== "twilio" || !channel.credentials_encrypted) return json({ error: "Configura primero el canal Twilio" }, 400);
      const creds = await decryptCredentials(channel.credentials_encrypted);
      if (!creds.auth_token) return json({ error: "Captura el Auth Token de esta subcuenta para verificar los eventos de Twilio" }, 400);
      if (!creds.twiml_app_sid) {
        const app = await twilioRequest(creds, "Applications.json", new URLSearchParams({ FriendlyName: "Walix Voice", VoiceUrl: `${SUPABASE_URL}/functions/v1/telephony-webhook?token=${channel.webhook_token}&leg=browser`, VoiceMethod: "POST" }));
        creds.twiml_app_sid = app.sid;
        const { error } = await admin.from("call_channels").update({ credentials_encrypted: await encryptCredentials(creds) }).eq("id", channel.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === "start") {
      const mode = body.mode ?? "phone";
      if (!["phone", "browser"].includes(mode)) return json({ error: "Modalidad inválida" }, 400);
      const contactId = body?.contact_id as string | undefined;
      const toNumber = (body?.to_number as string | undefined)?.trim();
      if (!toNumber || toNumber.length < 6) return json({ error: "Número destino inválido" }, 400);

      // Validar que el contacto pertenece al tenant y (si es vendedor) que es suyo
      let contact: any = null;
      if (contactId) {
        const { data } = await userClient.from("contacts")
          .select("id, tenant_id, owner_id, phone").eq("tenant_id", tenantId).eq("id", contactId).single();
        if (!data || data.tenant_id !== tenantId) return json({ error: "Contacto no encontrado" }, 404);
        contact = data;
      }

      // Canal activo del tenant
      const { data: channel } = await admin.from("call_channels")
        .select("*").eq("tenant_id", tenantId).eq("status", "active")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!channel) return json({ error: "No hay canal de llamadas configurado. Pide a un administrador que lo active en Configuración → Llamadas." }, 400);

      // Oportunidad abierta más reciente del contacto (para la actividad)
      let dealId: string | null = null;
      if (contactId) {
        const { data: deal } = await admin.from("deals")
          .select("id").eq("contact_id", contactId).eq("tenant_id", tenantId)
          .eq("is_won", false).eq("is_lost", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
        dealId = deal?.id ?? null;
      }

      const credentials = channel.credentials_encrypted
        ? await decryptCredentials(channel.credentials_encrypted)
        : null;
      if (channel.provider === "twilio" && !credentials?.auth_token) return json({ error: "Guarda el Auth Token de la subcuenta en el canal Twilio para registrar resultados automáticos seguros" }, 400);
      const { data: caller } = await admin.from("profiles").select("phone").eq("id", user.id).maybeSingle();

      const provider = getTelephonyProvider({
        provider: channel.provider,
        phone_number: channel.phone_number,
        credentials,
      });
      const callId = crypto.randomUUID();
      const callbackBase = channel.webhook_token ? `${SUPABASE_URL}/functions/v1/telephony-webhook?token=${channel.webhook_token}&call_id=${callId}` : null;
      if (mode === "browser") {
        if (channel.provider !== "twilio" || !credentials?.twiml_app_sid || !credentials.auth_token) return json({ error: "Un administrador debe habilitar llamadas desde computadora en Configuración → Llamadas" }, 400);
        const AccessToken = twilio.jwt.AccessToken;
        const token = new AccessToken(credentials.account_sid, credentials.api_key_sid, credentials.api_key_secret, { identity: user.id, ttl: 300 });
        token.addGrant(new AccessToken.VoiceGrant({ outgoingApplicationSid: credentials.twiml_app_sid, incomingAllow: false }));
        const { data: call, error } = await admin.from("calls").insert({ id: callId, tenant_id: tenantId, channel_id: channel.id, contact_id: contactId ?? null, deal_id: dealId, user_id: user.id, direction: "outbound", from_number: channel.phone_number, to_number: toNumber, status: "queued", metadata: { mode: "browser" }, started_at: new Date().toISOString() }).select("id,status").single();
        if (error) throw error;
        return json({ ok: true, call, provider: channel.provider, mode, token: token.toJwt() });
      }
      const started = await provider.startCall(toNumber, channel.phone_number, {
        bridgingTo: caller?.phone ?? null,
        recordCalls: !!channel.record_calls,
        recordingNotice: channel.recording_notice ?? null,
        statusCallbackUrl: callbackBase ? `${callbackBase}&leg=advisor` : null,
        dialCallbackUrl: callbackBase ? `${callbackBase}&leg=lead` : null,
      });

      const { data: call, error: insErr } = await admin.from("calls").insert({
        id: callId,
        tenant_id: tenantId,
        channel_id: channel.id,
        contact_id: contactId ?? null,
        deal_id: dealId,
        user_id: user.id,
        direction: "outbound",
        from_number: channel.phone_number,
        to_number: toNumber,
        status: started.status,
        provider_call_id: started.providerCallId,
        started_at: new Date().toISOString(),
      }).select("id, status, provider_call_id").single();
      if (insErr) throw insErr;

      return json({ ok: true, call, provider: channel.provider });
    }

    if (action === "status") {
      const { data: call, error } = await userClient.from("calls").select("id,status,answered_at,ended_at,duration_seconds,transcript,ai_summary,ai_suggestions,deal_id").eq("id", body.call_id).eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      if (!call) return json({ error: "Llamada no encontrada" }, 404);
      return json({ ok: true, call });
    }

    if (action === "end") {
      const callId = body?.call_id as string | undefined;
      if (!callId) return json({ error: "call_id requerido" }, 400);
      const outcome = (body?.outcome as string | undefined) ?? null;
      const notes = (body?.notes as string | undefined) ?? null;
      const status = (body?.status as string | undefined) ?? "completed";
      const duration = Number.isFinite(body?.duration_seconds) ? Math.max(0, Math.floor(body.duration_seconds)) : null;
      const allowed = ["completed", "failed", "no_answer", "busy", "voicemail"];
      if (!allowed.includes(status)) return json({ error: "Estado inválido" }, 400);

      const { data: call } = await admin.from("calls").select("id, tenant_id, user_id, provider_call_id, channel_id")
        .eq("id", callId).single();
      if (!call || call.tenant_id !== tenantId) return json({ error: "Llamada no encontrada" }, 404);
      if (call.user_id !== user.id) {
        const { data: roles } = await admin.from("user_roles").select("role")
          .eq("user_id", user.id).eq("tenant_id", tenantId);
        const canManage = (roles ?? []).some((r: any) => ["tenant_admin", "tenant_owner", "sales_manager"].includes(r.role));
        if (!canManage) return json({ error: "Solo puedes cerrar tus propias llamadas" }, 403);
      }

      const { data: channel } = await admin.from("call_channels").select("*").eq("id", call.channel_id).eq("tenant_id", tenantId).maybeSingle();
      if (channel?.provider === "twilio") {
        if (call.provider_call_id && channel.credentials_encrypted) {
          const credentials = await decryptCredentials(channel.credentials_encrypted);
          await twilioRequest(credentials, `Calls/${call.provider_call_id}.json`, new URLSearchParams({ Status: "completed" }));
        }
        // The provider, not a manual button, establishes connection and duration.
        return json({ ok: true });
      }
      const { error: upErr } = await admin.from("calls").update({
        status, outcome, notes,
        duration_seconds: duration,
        answered_at: status === "completed" ? new Date().toISOString() : null,
        ended_at: new Date().toISOString(),
      }).eq("id", callId);
      if (upErr) throw upErr;

      return json({ ok: true });
    }

    if (action === "simulate_inbound") {
      const fromNumber = String(body?.from_number ?? "").trim();
      if (fromNumber.replace(/\D/g, "").length < 7) return json({ error: "Número de origen inválido" }, 400);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
      if (!(roles ?? []).some((r: any) => ["tenant_admin", "tenant_owner", "sales_manager"].includes(r.role))) {
        return json({ error: "Solo administradores pueden simular llamadas" }, 403);
      }
      const { data: channel } = await admin.from("call_channels").select("*")
        .eq("tenant_id", tenantId).eq("status", "active").order("created_at").limit(1).maybeSingle();
      if (!channel) return json({ error: "No hay canal de llamadas activo" }, 400);
      const digit = body?.digit ? String(body.digit).slice(0, 1) : null;
      const r = await routeInboundCall(admin, { channel, fromNumber, digit, providerCallId: `sim_in_${crypto.randomUUID()}` });
      return json({ ok: true, ...r });
    }

    if (action === "answer" || action === "decline") {
      const callId = body?.call_id as string | undefined;
      const { data: call } = await admin.from("calls").select("id, tenant_id, user_id, status")
        .eq("id", callId ?? "").maybeSingle();
      if (!call || call.tenant_id !== tenantId) return json({ error: "Llamada no encontrada" }, 404);
      if (call.user_id && call.user_id !== user.id) return json({ error: "Esta llamada es de otro asesor" }, 403);
      if (call.status !== "ringing") return json({ error: "La llamada ya no está sonando" }, 409);
      const now = new Date().toISOString();
      const upd = action === "answer"
        ? { status: "answered", answered_at: now, user_id: user.id }
        : { status: "no_answer", ended_at: now, outcome: "Rechazada por el asesor", user_id: user.id };
      await admin.from("calls").update(upd).eq("id", call.id);
      return json({ ok: true });
    }

    if (action === "save_credentials") {
      const channelId = body?.channel_id as string | undefined;
      const incoming = body?.credentials as Record<string, string> | undefined;
      if (!channelId || !incoming || typeof incoming !== "object") {
        return json({ error: "Faltan el canal o las credenciales" }, 400);
      }
      const { data: roles } = await admin.from("user_roles").select("role")
        .eq("user_id", user.id).eq("tenant_id", tenantId);
      if (!(roles ?? []).some((r: any) => ADMIN_ROLES.includes(r.role))) {
        return json({ error: "Solo administradores pueden guardar credenciales" }, 403);
      }
      const { data: channel } = await admin.from("call_channels")
        .select("id, provider, webhook_token, credentials_encrypted").eq("id", channelId).eq("tenant_id", tenantId).maybeSingle();
      if (!channel) return json({ error: "Canal no encontrado" }, 404);

      const allowed = CRED_KEYS[channel.provider] ?? [];
      if (!allowed.length) return json({ error: "Este canal no usa credenciales" }, 400);
      const clean: Record<string, string> = {};
      for (const key of allowed) {
        const v = incoming[key];
        if (typeof v === "string" && v.trim()) clean[key] = v.trim();
      }
      if (Object.keys(clean).length !== allowed.length) {
        if (channel.provider === "twilio" && Object.keys(clean).length === 0 && typeof incoming.auth_token === "string" && incoming.auth_token.trim() && channel.credentials_encrypted) {
          Object.assign(clean, await decryptCredentials(channel.credentials_encrypted));
        } else return json({ error: "Faltan credenciales por capturar" }, 400);
      }

      if (channel.provider === "twilio") {
        const previous = channel.credentials_encrypted ? await decryptCredentials(channel.credentials_encrypted) : {};
        if (previous.account_sid === clean.account_sid) {
          if (previous.twiml_app_sid) clean.twiml_app_sid = previous.twiml_app_sid;
          if (previous.auth_token) clean.auth_token = previous.auth_token;
        }
        if (typeof incoming.auth_token === "string" && incoming.auth_token.trim()) clean.auth_token = incoming.auth_token.trim();
      }

      const patch: Record<string, unknown> = { credentials_encrypted: await encryptCredentials(clean) };
      if (!channel.webhook_token) patch.webhook_token = crypto.randomUUID().replace(/-/g, "");
      const { error: upErr } = await admin.from("call_channels").update(patch).eq("id", channelId);
      if (upErr) throw upErr;
      return json({ ok: true, configured: true });
    }

    return json({ error: "Acción no reconocida" }, 400);
  } catch (e) {
    console.error("telephony-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});
