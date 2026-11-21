import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getTelephonyProvider } from "../_shared/telephony-provider.ts";
import { routeInboundCall } from "../_shared/telephony-routing.ts";
import { isRecordingDownloadable, recordingFileName } from "../_shared/call-recording.ts";
import { decryptCredentials, encryptCredentials } from "../_shared/telephony-creds.ts";
import twilio from "npm:twilio@5.10.4";
import { twilioRequest } from "../_shared/twilio-auth.ts";
import { canUsePhone, canEditPhonePolicy } from "../_shared/phone-call-policy.ts";
import { validateReceivingPreference } from "../_shared/inbound-phone-policy.ts";
import { defaultInboundPolicy, mayReceivePhone } from "../_shared/inbound-routing-policy.ts";
import { inboundBrowserIdentity } from "../_shared/inbound-browser.ts";

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

    if (action === "inbound_browser_token") {
      const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).limit(1);
      const { data: member, error: memberError } = await admin.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
      if (roleError || memberError) throw roleError ?? memberError;
      if (!roles?.length || !member?.is_active) return json({ error: "Sin acceso activo a esta empresa" }, 403);
      const { data: channels, error: channelError } = await admin.from("call_channels").select("id,credentials_encrypted").eq("tenant_id", tenantId).eq("provider", "twilio").eq("status", "active").order("created_at");
      if (channelError) throw channelError;
      const tokens = [];
      for (const channel of channels ?? []) {
        if (!channel.credentials_encrypted) continue;
        const creds = await decryptCredentials(channel.credentials_encrypted);
        if (!creds.account_sid || !creds.api_key_sid || !creds.api_key_secret) continue;
        const AccessToken = twilio.jwt.AccessToken;
        const token = new AccessToken(creds.account_sid, creds.api_key_sid, creds.api_key_secret, { identity: inboundBrowserIdentity(tenantId, user.id), ttl: 120 });
        token.addGrant(new AccessToken.VoiceGrant({ incomingAllow: true }));
        tokens.push({ channel_id: channel.id, token: token.toJwt() });
      }
      return json({ ok: true, tokens });
    }

    if (action === "inbound_policy" || action === "save_inbound_policy") {
      const { data: roles, error: rolesError } = await admin.from("user_roles").select("role").eq("tenant_id", tenantId).eq("user_id", user.id);
      const { data: member } = await admin.from("profiles").select("is_active,phone").eq("id", user.id).maybeSingle();
      if (rolesError) throw rolesError;
      if (!roles?.length || !member?.is_active) return json({ error: "No tienes acceso activo a esta empresa" }, 403);
      const canManage = canEditPhonePolicy(roles.map((r: { role: string }) => r.role));
      const { data: stored, error: policyError } = await admin.from("tenant_inbound_call_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (policyError) throw policyError;
      const policy = stored ?? defaultInboundPolicy;
      if (action === "inbound_policy") {
        const { data: preference, error } = await admin.from("tenant_call_receiving_preferences").select("phone_enabled").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        let members: unknown[] = [];
        if (canManage) {
          const { data: allRoles, error: roleError } = await admin.from("user_roles").select("user_id,role").eq("tenant_id", tenantId);
          if (roleError) throw roleError;
          const ids = [...new Set((allRoles ?? []).map((r: { user_id: string }) => r.user_id))];
          if (ids.length) {
            const { data, error: memberError } = await admin.from("profiles").select("id,full_name,phone").in("id", ids).eq("is_active", true).order("full_name");
            if (memberError) throw memberError;
            members = data ?? [];
          }
        }
        return json({ ok: true, can_manage: canManage, can_receive_phone: mayReceivePhone(policy, user.id), phone: member.phone, phone_enabled: !!preference?.phone_enabled, ...(canManage ? { policy, members } : {}) });
      }
      if (!canManage) return json({ error: "Solo propietarios y administradores pueden configurar la recepción" }, 403);
      const p = body.policy;
      if (!p || !["specific", "all", "supervisors", "advisors"].includes(p.unassigned_mode) || !["none", "all", "selected"].includes(p.phone_mode) || !Array.isArray(p.allowed_user_ids) || p.allowed_user_ids.length > 1000 || p.allowed_user_ids.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) || (p.unassigned_mode === "specific" && (typeof p.unassigned_user_id !== "string" || !/^[0-9a-f-]{36}$/i.test(p.unassigned_user_id)))) return json({ error: "Selecciona opciones y miembros válidos" }, 400);
      const ids = [...new Set<string>([...p.allowed_user_ids, ...(p.unassigned_mode === "specific" ? [p.unassigned_user_id] : [])])];
      if (ids.length) {
        const { data: scoped, error } = await admin.from("user_roles").select("user_id").eq("tenant_id", tenantId).in("user_id", ids);
        const { data: active, error: activeError } = await admin.from("profiles").select("id").in("id", ids).eq("is_active", true);
        if (error || activeError) throw error ?? activeError;
        if (ids.some(id => !scoped?.some((r: { user_id: string }) => r.user_id === id) || !active?.some((r: { id: string }) => r.id === id))) return json({ error: "Los destinatarios deben ser miembros activos de esta empresa" }, 403);
      }
      const { error } = await admin.from("tenant_inbound_call_settings").upsert({ tenant_id: tenantId, unassigned_mode: p.unassigned_mode, unassigned_user_id: p.unassigned_mode === "specific" ? p.unassigned_user_id : null, phone_mode: p.phone_mode, allowed_user_ids: [...new Set(p.allowed_user_ids)], updated_by: user.id, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "save_inbound_preference") {
      const { data: roles, error: rolesError } = await admin.from("user_roles").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).limit(1);
      const { data: member, error: memberError } = await admin.from("profiles").select("is_active,phone").eq("id", user.id).maybeSingle();
      if (rolesError || memberError) throw rolesError ?? memberError;
      if (!roles?.length || !member?.is_active) return json({ error: "No tienes acceso activo a esta empresa" }, 403);
      const { data: policy, error: policyError } = await admin.from("tenant_inbound_call_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (policyError) throw policyError;
      if (body.phone_enabled === true && !mayReceivePhone(policy ?? defaultInboundPolicy, user.id)) return json({ error: "Tu empresa no te ha autorizado a recibir llamadas en celular" }, 403);
      const normalized = (member.phone ?? "").trim().replace(/[\s()-]/g, "");
      const { data: channels, error: channelError } = await admin.from("call_channels").select("phone_number").eq("phone_number", normalized).limit(1);
      if (channelError) throw channelError;
      const result = validateReceivingPreference(body.phone_enabled, body.phone_enabled === true ? member.phone : null, (channels ?? []).map((c: { phone_number: string }) => c.phone_number));
      if (result.error) return json({ error: result.error }, 400);
      // Keep a profile snapshot for the legacy constraint; routing never reads it.
      const { error } = await admin.from("tenant_call_receiving_preferences").upsert({ tenant_id: tenantId, user_id: user.id, phone_enabled: result.enabled, phone_number: result.phone, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "inbound_setup" || action === "inbound_status") {
      const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
      const { data: member } = await admin.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
      if (roleError) throw roleError;
      if (!member?.is_active || !canEditPhonePolicy((roles ?? []).map((r: { role: string }) => r.role))) return json({ error: "Solo administradores y propietarios pueden activar la recepción" }, 403);
      const { data: channel } = await admin.from("call_channels").select("*").eq("id", body.channel_id).eq("tenant_id", tenantId).eq("status", "active").maybeSingle();
      if (!channel || channel.provider !== "twilio" || !channel.credentials_encrypted || !channel.webhook_token) return json({ error: "Configura primero un canal Twilio activo" }, 400);
      const creds = await decryptCredentials(channel.credentials_encrypted);
      if (!creds.auth_token) return json({ error: "Guarda el Auth Token de la subcuenta para verificar las entrantes" }, 400);
      const numbers = await twilioRequest(creds, `IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(channel.phone_number)}`);
      const number = numbers.incoming_phone_numbers?.find((n: { phone_number: string }) => n.phone_number === channel.phone_number);
      if (!number?.sid) return json({ error: "El número no pertenece a esta subcuenta" }, 400);
      const base = `${SUPABASE_URL}/functions/v1/telephony-webhook?token=${channel.webhook_token}`;
      if (action === "inbound_status") return json({ ok: true, configured: number.voice_url === `${base}&leg=inbound`, has_voice_handler: !!number.voice_url, mode: "personal_preference" });
      await twilioRequest(creds, `IncomingPhoneNumbers/${number.sid}.json`, new URLSearchParams({ VoiceUrl: `${base}&leg=inbound`, VoiceMethod: "POST", StatusCallback: `${base}&leg=inbound-status`, StatusCallbackMethod: "POST" }));
      return json({ ok: true, mode: "personal_preference" });
    }

    if (["phone_permissions", "save_phone_permissions", "start"].includes(action)) {
      const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
      if (roleError) throw roleError;
      const { data: member, error: memberError } = await admin.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
      if (memberError) throw memberError;
      const isMember = !!roles?.length && member?.is_active === true;
      if (!isMember) return json({ error: "No tienes acceso activo a esta empresa" }, 403);
      const { data: policy, error: policyError } = await admin.from("tenant_phone_call_settings").select("allow_all,allowed_user_ids").eq("tenant_id", tenantId).maybeSingle();
      if (policyError) throw policyError;
      const canManage = canEditPhonePolicy((roles ?? []).map((r: { role: string }) => r.role));
      if (action === "phone_permissions") {
        let members: { id: string; full_name: string | null; phone: string | null }[] = [];
        if (canManage) {
          const { data: memberRoles, error } = await admin.from("user_roles").select("user_id").eq("tenant_id", tenantId);
          if (error) throw error;
          const ids = [...new Set((memberRoles ?? []).map((r: { user_id: string }) => r.user_id))];
          if (ids.length) {
            const { data, error } = await admin.from("profiles").select("id,full_name,phone").in("id", ids).eq("is_active", true).order("full_name");
            if (error) throw error;
            members = data ?? [];
          }
        }
        return json({ ok: true, can_manage: canManage, can_use_phone: canUsePhone(policy, user.id, isMember), ...(canManage ? { policy: policy ?? { allow_all: true, allowed_user_ids: [] }, members } : {}) });
      }
      if (action === "save_phone_permissions") {
        if (!canManage) return json({ error: "Solo administradores y propietarios pueden configurar llamadas por celular" }, 403);
        if (typeof body.allow_all !== "boolean" || !Array.isArray(body.allowed_user_ids) || body.allowed_user_ids.length > 1000 || body.allowed_user_ids.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return json({ error: "Selecciona usuarios válidos" }, 400);
        const ids: string[] = [...new Set<string>(body.allowed_user_ids)];
        if (ids.length) {
          const { data, error } = await admin.from("user_roles").select("user_id").eq("tenant_id", tenantId).in("user_id", ids);
          if (error) throw error;
          if (new Set((data ?? []).map((r: { user_id: string }) => r.user_id)).size !== ids.length) return json({ error: "Los usuarios deben pertenecer a esta empresa" }, 403);
        }
        const { error } = await admin.from("tenant_phone_call_settings").upsert({ tenant_id: tenantId, allow_all: body.allow_all, allowed_user_ids: ids, updated_by: user.id, updated_at: new Date().toISOString() });
        if (error) throw error;
        return json({ ok: true });
      }
      if ((body.mode ?? "phone") === "phone" && !canUsePhone(policy, user.id, isMember)) return json({ error: "Un administrador o propietario debe autorizarte a llamar desde tu celular. Puedes usar la computadora." }, 403);
    }

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
        advisorAcceptUrl: callbackBase && channel.provider === "twilio" ? `${callbackBase}&leg=advisor-accept` : null,
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

    if (action === "recording_download") {
      if (typeof body.call_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.call_id)) return json({ error: "Llamada inválida" }, 400);
      // RLS on the caller's client decides who may see this call.
      const { data: call, error } = await userClient.from("calls").select("id,channel_id,status,recording_url,duration_seconds,answered_at,created_at,contacts(name)").eq("id", body.call_id).eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      if (!call) return json({ error: "Llamada no encontrada" }, 404);
      if (!isRecordingDownloadable(call)) return json({ error: "Esta llamada no tiene grabación de una conversación" }, 404);
      const { data: channel, error: chErr } = await admin.from("call_channels").select("credentials_encrypted,provider").eq("id", call.channel_id).eq("tenant_id", tenantId).maybeSingle();
      if (chErr) throw chErr;
      if (!channel?.credentials_encrypted || channel.provider !== "twilio") return json({ error: "Canal sin credenciales" }, 409);
      const creds = await decryptCredentials(channel.credentials_encrypted);
      const url = String(call.recording_url);
      if (!url.startsWith(`https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Recordings/`)) return json({ error: "Grabación no válida" }, 409);
      const user_ = creds.api_key_sid ?? creds.account_sid, pass = creds.api_key_secret ?? creds.auth_token;
      const res = await fetch(`${url.replace(/\.(mp3|wav|json)$/, "")}.mp3`, { headers: { Authorization: `Basic ${btoa(`${user_}:${pass}`)}` } });
      if (!res.ok) { console.error("recording fetch", res.status, await res.text()); return json({ error: "El proveedor no entregó la grabación", status: res.status }, 502); }
      await admin.from("audit_log").insert({ tenant_id: tenantId, actor_id: user.id, actor_email: user.email, action: "call_recording_download", target_type: "call", target_id: call.id, metadata: {} });
      const name = recordingFileName((call as any).contacts?.name ?? null, call.created_at);
      return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Access-Control-Expose-Headers": "Content-Disposition", "Content-Disposition": `attachment; filename="${name}"` } });
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

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) return json({ error: "Llamada inválida" }, 400);
      const { data: call } = await admin.from("calls").select("id, tenant_id, user_id, provider_call_id, channel_id, ended_at, hangup_by, hangup_at")
        .eq("id", callId).single();
      if (!call || call.tenant_id !== tenantId) return json({ error: "Llamada no encontrada" }, 404);
      if (call.user_id !== user.id) {
        const { data: roles } = await admin.from("user_roles").select("role")
          .eq("user_id", user.id).eq("tenant_id", tenantId);
        const canManage = (roles ?? []).some((r: any) => ["tenant_admin", "tenant_owner", "sales_manager"].includes(r.role));
        if (!canManage) return json({ error: "Solo puedes cerrar tus propias llamadas" }, 403);
      }

      if (call.ended_at) return json({ ok: true });

      const { data: channel } = await admin.from("call_channels").select("*").eq("id", call.channel_id).eq("tenant_id", tenantId).maybeSingle();
      if (channel?.provider === "twilio") {
        if (call.provider_call_id && channel.credentials_encrypted) {
          const credentials = await decryptCredentials(channel.credentials_encrypted);
          const now = new Date().toISOString();
          // Claim before contacting the provider so its callback cannot overwrite the actor.
          const { data: claimed, error: claimError } = await admin.from("calls")
            .update({ hangup_by: "agent", hangup_at: now }).eq("id", callId).eq("tenant_id", tenantId)
            .is("ended_at", null).is("hangup_by", null).select("id").maybeSingle();
          if (claimError) throw claimError;
          if (!claimed) return json({ ok: true });
          try {
            await twilioRequest(credentials, `Calls/${call.provider_call_id}.json`, new URLSearchParams({ Status: "completed" }));
          } catch (error) {
            // A rejected request is not evidence that the advisor ended the call.
            const { error: rollbackError } = await admin.from("calls").update({ hangup_by: null, hangup_at: call.hangup_at })
              .eq("id", callId).eq("tenant_id", tenantId).eq("hangup_by", "agent").eq("hangup_at", now).is("ended_at", null);
            if (rollbackError) throw rollbackError;
            throw error;
          }
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
      const r = await routeInboundCall(admin, { channel, fromNumber, digit, providerCallId: `sim_in_${crypto.randomUUID()}`, useReceivingPreference: true });
      return json({ ok: true, ...r });
    }

    if (action === "answer" || action === "decline") {
      const callId = body?.call_id as string | undefined;
      const { data: call } = await userClient.from("calls").select("id, tenant_id, user_id, status, provider_call_id")
        .eq("id", callId ?? "").maybeSingle();
      if (!call || call.tenant_id !== tenantId) return json({ error: "Llamada no encontrada" }, 404);
      if (call.provider_call_id && !call.provider_call_id.startsWith("sim_")) return json({ error: "La recepción real se confirma por el proveedor, no desde este aviso" }, 409);
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
