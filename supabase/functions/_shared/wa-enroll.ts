// Enrolamiento de un contacto en la campaña activa de mayor prioridad que cumpla.
import { matchContacts, type CampaignConditions } from "./wa-campaigns.ts";

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

    const { error } = await sb.from("wa_enrollments").insert({
      tenant_id: tenantId,
      campaign_id: campaign.id,
      contact_id: contactId,
      status: "active",
      current_step: 0,
      next_send_at: new Date().toISOString(),
    });
    if (error) {
      console.error("enroll insert failed", error.message);
      return null;
    }
    return campaign.id;
  }
  return null;
}
