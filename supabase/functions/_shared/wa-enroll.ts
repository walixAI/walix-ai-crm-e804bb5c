// Enrolamiento de un contacto en la campaña activa de mayor prioridad que cumpla.
import { matchContacts, type CampaignConditions } from "./wa-campaigns.ts";

/** Oportunidad más reciente del contacto: se guarda para poder cortar la secuencia si cambia. */
async function latestDeal(sb: any, tenantId: string, contactId: string) {
  const { data } = await sb
    .from("deals")
    .select("id, stage_id")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function insertEnrollment(
  sb: any,
  tenantId: string,
  campaignId: string,
  contactId: string,
): Promise<boolean> {
  const deal = await latestDeal(sb, tenantId, contactId);
  // El primer paso también espera: si la secuencia dice «esperar 24 h», el
  // primer mensaje no sale al instante de enrolar.
  const { data: first } = await sb
    .from("wa_campaign_steps")
    .select("wait_hours")
    .eq("campaign_id", campaignId)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  const wait = Math.max(0, Number(first?.wait_hours ?? 0));
  const { error } = await sb.from("wa_enrollments").insert({
    tenant_id: tenantId,
    campaign_id: campaignId,
    contact_id: contactId,
    deal_id: deal?.id ?? null,
    enrolled_stage_id: deal?.stage_id ?? null,
    status: "active",
    current_step: 0,
    next_send_at: new Date(Date.now() + wait * 3600_000).toISOString(),
  });
  if (error) {
    console.error("enroll insert failed", error.message);
    return false;
  }
  return true;
}

export async function enrollContact(sb: any, tenantId: string, contactId: string): Promise<string | null> {
  const { data: campaigns } = await sb
    .from("wa_campaigns")
    .select("id, conditions, priority")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  for (const campaign of campaigns ?? []) {
    let matches = false;
    try {
      const { ids } = await matchContacts(sb, tenantId, (campaign.conditions ?? {}) as CampaignConditions, 1000);
      matches = ids.includes(contactId);
    } catch (e) {
      console.error("enroll match failed", campaign.id, e);
      continue;
    }
    if (!matches) continue;

    const { data: existing } = await sb
      .from("wa_enrollments").select("id").eq("campaign_id", campaign.id).eq("contact_id", contactId).maybeSingle();
    if (existing) return campaign.id;

    return (await insertEnrollment(sb, tenantId, campaign.id, contactId)) ? campaign.id : null;
  }
  return null;
}

/**
 * Inscribe a quien ya cumple las condiciones de una campaña activa pero no estaba
 * dentro: los leads que llegan por WhatsApp (no pasan por un formulario) y los que
 * cumplen un filtro por tiempo, como «sin respuesta 7 días».
 * Un contacto solo puede estar en una secuencia a la vez.
 */
export async function scanAndEnroll(sb: any, tenantId: string, limit = 300): Promise<number> {
  const { data: campaigns } = await sb
    .from("wa_campaigns")
    .select("id, conditions, priority")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (!campaigns?.length) return 0;

  const { data: rows } = await sb
    .from("wa_enrollments")
    .select("campaign_id, contact_id, status")
    .eq("tenant_id", tenantId);
  const seen = new Set((rows ?? []).map((r: any) => `${r.campaign_id}:${r.contact_id}`));
  const busy = new Set(
    (rows ?? []).filter((r: any) => r.status === "active").map((r: any) => r.contact_id),
  );

  let enrolled = 0;
  for (const campaign of campaigns) {
    let ids: string[] = [];
    try {
      ids = (await matchContacts(sb, tenantId, (campaign.conditions ?? {}) as CampaignConditions, limit)).ids;
    } catch (e) {
      console.error("campaign scan match failed", campaign.id, e);
      continue;
    }
    for (const contactId of ids) {
      if (seen.has(`${campaign.id}:${contactId}`) || busy.has(contactId)) continue;
      if (await insertEnrollment(sb, tenantId, campaign.id, contactId)) {
        seen.add(`${campaign.id}:${contactId}`);
        busy.add(contactId);
        enrolled++;
      }
    }
  }
  return enrolled;
}
