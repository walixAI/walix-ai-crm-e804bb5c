// Worker periódico e idempotente: ejecuta los pasos programados de cada enrolamiento activo.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  defaultClientsChannel, ensureConversation, isWithinSchedule, renderText,
  sendTemplate, sendText, serviceWindowOpen,
} from "../_shared/wa-campaigns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb
    .from("wa_enrollments")
    .select("id, tenant_id, campaign_id, contact_id, current_step, next_send_at")
    .eq("status", "active")
    .lte("next_send_at", nowIso)
    .order("next_send_at", { ascending: true })
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  let sent = 0, skipped = 0, finished = 0, failed = 0;
  const channelCache = new Map<string, any>();

  for (const e of due ?? []) {
    try {
      const { data: campaign } = await sb
        .from("wa_campaigns").select("id, name, is_active, schedule").eq("id", e.campaign_id).maybeSingle();
      if (!campaign?.is_active) {
        await sb.from("wa_enrollments").update({ status: "stopped", exit_reason: "campaña inactiva", next_send_at: null }).eq("id", e.id);
        skipped++; continue;
      }
      if (!isWithinSchedule(campaign.schedule)) {
        await sb.from("wa_enrollments").update({ next_send_at: new Date(Date.now() + 30 * 60_000).toISOString() }).eq("id", e.id);
        skipped++; continue;
      }

      const { data: steps } = await sb
        .from("wa_campaign_steps")
        .select("id, step_order, wait_hours, kind, template_id, template_variables, body_text")
        .eq("campaign_id", e.campaign_id)
        .order("step_order", { ascending: true });
      const list = steps ?? [];
      const step = list[e.current_step];
      if (!step) {
        await sb.from("wa_enrollments").update({ status: "completed", next_send_at: null, exit_reason: "secuencia terminada" }).eq("id", e.id);
        finished++; continue;
      }

      // Idempotencia: si el paso ya se envió con éxito, avanzar sin reenviar.
      const { data: prevSends } = await sb
        .from("wa_step_sends").select("id, status").eq("enrollment_id", e.id).eq("step_id", step.id);
      const attempts = (prevSends ?? []).length;
      if ((prevSends ?? []).some((s: any) => s.status === "sent")) { await advance(sb, e, list); skipped++; continue; }

      const { data: contact } = await sb
        .from("contacts").select("id, name, phone, company, owner_id").eq("id", e.contact_id).maybeSingle();
      if (!contact?.phone) {
        await sb.from("wa_enrollments").update({ status: "failed", exit_reason: "contacto sin teléfono", next_send_at: null }).eq("id", e.id);
        failed++; continue;
      }

      let channel = channelCache.get(e.tenant_id);
      if (channel === undefined) {
        channel = await defaultClientsChannel(sb, e.tenant_id);
        channelCache.set(e.tenant_id, channel);
      }
      if (!channel) {
        await sb.from("wa_enrollments").update({ status: "failed", exit_reason: "sin canal de WhatsApp", next_send_at: null }).eq("id", e.id);
        failed++; continue;
      }

      const { data: tenant } = await sb.from("tenants").select("name").eq("id", e.tenant_id).maybeSingle();
      const vars: Record<string, string> = {
        nombre: (contact.name ?? "").split(" ")[0] ?? "",
        nombre_completo: contact.name ?? "",
        empresa: tenant?.name ?? "",
        compania: contact.company ?? "",
      };

      let template: any = null;
      if (step.template_id) {
        const { data } = await sb.from("wa_templates").select("name, language, body_text").eq("id", step.template_id).maybeSingle();
        template = data;
      }

      const windowOpen = await serviceWindowOpen(sb, e.tenant_id, e.contact_id);
      let result: { wamid?: string; error?: string };
      let usedKind: "template" | "text" = "text";
      let bodyPreview = renderText(step.body_text ?? "", vars);
      let status = "sent";

      if (step.kind === "text" && windowOpen) {
        result = await sendText(channel, contact.phone, bodyPreview);
      } else if (template?.name) {
        usedKind = "template";
        const params = ((step.template_variables ?? []) as string[]).map((p) => renderText(String(p), vars));
        bodyPreview = renderText(template.body_text ?? step.body_text ?? `Plantilla ${template.name}`, vars);
        result = await sendTemplate(channel, contact.phone, template.name, template.language ?? "es_MX", params);
      } else if (windowOpen) {
        result = await sendText(channel, contact.phone, bodyPreview);
      } else {
        // Fuera de la ventana y sin plantilla aprobada: avisar al asesor y marcar el paso.
        status = "pending_template";
        result = { error: "Fuera de la ventana de 24 h y el paso no tiene plantilla aprobada" };
        if (contact.owner_id) {
          await sb.from("notifications").insert({
            tenant_id: e.tenant_id, user_id: contact.owner_id, category: "operational", severity: "warning",
            type: "wa_campaign", title: "Seguimiento de campaña pendiente",
            body: `No se pudo enviar el paso ${(step.step_order ?? 0) + 1} de "${campaign.name}" a ${contact.name}: se necesita una plantilla aprobada.`,
            link: `/contactos/${contact.id}`,
          });
        }
      }

      const conversationId = result.wamid ? await ensureConversation(sb, e.tenant_id, e.contact_id, channel.id) : null;

      await sb.from("wa_step_sends").insert({
        tenant_id: e.tenant_id, enrollment_id: e.id, campaign_id: e.campaign_id, step_id: step.id,
        step_order: step.step_order ?? e.current_step, contact_id: e.contact_id, conversation_id: conversationId,
        wamid: result.wamid ?? null,
        status: result.error ? (status === "pending_template" ? "pending_template" : "failed") : "sent",
        error_message: result.error ?? null, sent_at: result.wamid ? nowIso : null,
      });

      if (result.wamid && conversationId) {
        await sb.from("messages").insert({
          tenant_id: e.tenant_id, conversation_id: conversationId, channel_id: channel.id,
          direction: "outbound", type: "text", body: bodyPreview, sent_at: nowIso,
          metadata: { wamid: result.wamid, campaign_id: e.campaign_id, step_id: step.id, kind: usedKind },
        });
        await sb.from("conversations").update({ last_message_at: nowIso, preview: bodyPreview.slice(0, 120) }).eq("id", conversationId);
        sent++;
      } else if (result.error) {
        failed++;
      }

      await advance(sb, e, list);
    } catch (err) {
      console.error("worker step error", e.id, err);
      failed++;
    }
  }

  return json({ ok: true, processed: due?.length ?? 0, sent, skipped, finished, failed });
});

async function advance(sb: any, enrollment: any, steps: any[]) {
  const nextIndex = enrollment.current_step + 1;
  const next = steps[nextIndex];
  if (!next) {
    await sb.from("wa_enrollments").update({
      status: "completed", current_step: nextIndex, next_send_at: null, exit_reason: "secuencia terminada",
    }).eq("id", enrollment.id);
    return;
  }
  const waitHours = Number(next.wait_hours ?? 24);
  await sb.from("wa_enrollments").update({
    current_step: nextIndex,
    next_send_at: new Date(Date.now() + waitHours * 3600_000).toISOString(),
  }).eq("id", enrollment.id);
}
