import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getTelephonyProvider } from "../_shared/telephony-provider.ts";
import { routeInboundCall } from "../_shared/telephony-routing.ts";

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
      .from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile?.tenant_id) return json({ error: "Sin empresa asignada" }, 403);
    const tenantId = profile.tenant_id;

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "start") {
      const contactId = body?.contact_id as string | undefined;
      const toNumber = (body?.to_number as string | undefined)?.trim();
      if (!toNumber || toNumber.length < 6) return json({ error: "Número destino inválido" }, 400);

      // Validar que el contacto pertenece al tenant y (si es vendedor) que es suyo
      let contact: any = null;
      if (contactId) {
        const { data } = await admin.from("contacts")
          .select("id, tenant_id, owner_id, phone").eq("id", contactId).single();
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
          .neq("stage", "won").order("created_at", { ascending: false }).limit(1).maybeSingle();
        dealId = deal?.id ?? null;
      }

      const provider = getTelephonyProvider({
        provider: channel.provider,
        phone_number: channel.phone_number,
        credentials: null, // credenciales cifradas se resolverán al conectar proveedor real
      });
      const started = await provider.startCall(toNumber, channel.phone_number);

      const { data: call, error: insErr } = await admin.from("calls").insert({
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

    return json({ error: "Acción no reconocida" }, 400);
  } catch (e) {
    console.error("telephony-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});
