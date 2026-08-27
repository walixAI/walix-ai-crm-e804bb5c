// Envío puntual segmentado: plantilla o texto libre a los contactos que cumplen las condiciones.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  defaultClientsChannel, ensureConversation, matchContacts, renderText,
  sendTemplate, sendText, serviceWindowOpen, type CampaignConditions,
} from "../_shared/wa-campaigns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "No autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const conditions = (body?.conditions ?? {}) as CampaignConditions;
    const contactIds: string[] | null = Array.isArray(body?.contact_ids) ? body.contact_ids.slice(0, 1000) : null;
    const preview = body?.preview === true;
    const templateId: string | null = body?.template_id ?? null;
    const text: string = String(body?.text ?? "");
    if (!preview && !templateId && !text.trim()) return json({ error: "Escribe un mensaje o elige una plantilla" }, 400);
    if (text.length > 4000) return json({ error: "El mensaje es demasiado largo" }, 400);

    const { data: profile } = await userClient.from("profiles").select("tenant_id").eq("id", userData.user.id).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return json({ error: "Sin empresa asignada" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let ids: string[];
    let total: number;
    if (contactIds?.length) {
      ids = contactIds; total = contactIds.length;
    } else {
      const res = await matchContacts(sb, tenantId, conditions, 1000);
      ids = res.ids; total = res.total;
    }

    if (preview) {
      const { data: sample } = await sb.from("contacts").select("id, name, phone, company").in("id", ids.slice(0, 10));
      return json({ total, sample: sample ?? [] });
    }

    const channel = await defaultClientsChannel(sb, tenantId);
    if (!channel) return json({ error: "No hay un canal de WhatsApp activo" }, 400);

    let template: any = null;
    if (templateId) {
      const { data } = await sb.from("wa_templates").select("name, language, body_text").eq("id", templateId).eq("tenant_id", tenantId).maybeSingle();
      if (!data) return json({ error: "Plantilla no encontrada" }, 404);
      template = data;
    }

    const { data: tenant } = await sb.from("tenants").select("name").eq("id", tenantId).maybeSingle();
    const blastId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    let sent = 0, failed = 0;

    const { data: contacts } = await sb.from("contacts").select("id, name, phone, company").in("id", ids).not("phone", "is", null);

    for (const c of contacts ?? []) {
      const vars: Record<string, string> = {
        nombre: (c.name ?? "").split(" ")[0] ?? "",
        nombre_completo: c.name ?? "",
        empresa: tenant?.name ?? "",
        compania: c.company ?? "",
      };
      const windowOpen = await serviceWindowOpen(sb, tenantId, c.id);
      let result: { wamid?: string; error?: string };
      let bodyPreview = renderText(text, vars);

      if (template?.name && (!windowOpen || !text.trim())) {
        const params = ((body?.template_variables ?? []) as string[]).map((p) => renderText(String(p), vars));
        bodyPreview = renderText(template.body_text ?? `Plantilla ${template.name}`, vars);
        result = await sendTemplate(channel, c.phone, template.name, template.language ?? "es_MX", params);
      } else if (windowOpen) {
        result = await sendText(channel, c.phone, bodyPreview);
      } else {
        result = { error: "Fuera de la ventana de 24 h; se requiere plantilla aprobada" };
      }

      const conversationId = result.wamid ? await ensureConversation(sb, tenantId, c.id, channel.id) : null;
      await sb.from("wa_step_sends").insert({
        tenant_id: tenantId, contact_id: c.id, blast_id: blastId, conversation_id: conversationId,
        wamid: result.wamid ?? null, status: result.error ? "failed" : "sent",
        error_message: result.error ?? null, sent_at: result.wamid ? nowIso : null,
      });

      if (result.wamid && conversationId) {
        await sb.from("messages").insert({
          tenant_id: tenantId, conversation_id: conversationId, channel_id: channel.id,
          direction: "outbound", type: "text", body: bodyPreview, sent_at: nowIso,
          metadata: { wamid: result.wamid, blast_id: blastId },
        });
        await sb.from("conversations").update({ last_message_at: nowIso, preview: bodyPreview.slice(0, 120) }).eq("id", conversationId);
        sent++;
      } else {
        failed++;
      }
    }

    return json({ ok: true, blast_id: blastId, total: contacts?.length ?? 0, sent, failed });
  } catch (e) {
    console.error("segment send error", e);
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
