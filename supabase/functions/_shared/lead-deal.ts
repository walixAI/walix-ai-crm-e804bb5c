// Crea una oportunidad en la primera etapa del embudo principal para un lead nuevo (si no tiene una abierta).
export async function ensureLeadDeal(
  sb: any,
  tenantId: string,
  contactId: string,
  opts: { name: string; source: string; attributionId?: string | null },
): Promise<string | null> {
  const { data: open } = await sb.from("deals").select("id")
    .eq("tenant_id", tenantId).eq("contact_id", contactId)
    .eq("is_won", false).eq("is_lost", false).limit(1).maybeSingle();
  if (open?.id) return open.id;

  const { data: pipes } = await sb.from("pipelines").select("id, is_default, position")
    .eq("tenant_id", tenantId).order("is_default", { ascending: false }).order("position").limit(1);
  const pipelineId = pipes?.[0]?.id;
  if (!pipelineId) return null;
  const { data: stage } = await sb.from("pipeline_stages").select("id, name")
    .eq("pipeline_id", pipelineId).eq("is_won", false).eq("is_lost", false)
    .order("position").limit(1).maybeSingle();
  if (!stage) return null;

  // Reparto: asesor con menos oportunidades abiertas; si no, el dueño del contacto.
  const { data: contact } = await sb.from("contacts").select("owner_id").eq("id", contactId).maybeSingle();
  let ownerId: string | null = contact?.owner_id ?? null;
  if (!ownerId) {
    const { data: members } = await sb.from("profiles").select("id").eq("tenant_id", tenantId);
    let best: { id: string; n: number } | null = null;
    for (const m of members ?? []) {
      const { count } = await sb.from("deals").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("owner_id", m.id).eq("is_won", false).eq("is_lost", false);
      if (!best || (count ?? 0) < best.n) best = { id: m.id, n: count ?? 0 };
    }
    ownerId = best?.id ?? null;
    if (ownerId) await sb.from("contacts").update({ owner_id: ownerId }).eq("id", contactId);
  }

  const { data, error } = await sb.from("deals").insert({
    tenant_id: tenantId, contact_id: contactId, owner_id: ownerId,
    name: opts.name, stage_id: stage.id, stage_name: stage.name, amount: 0,
    source: opts.source, attribution_id: opts.attributionId ?? null,
  }).select("id").single();
  if (error) { console.error("ensureLeadDeal", error.message); return null; }
  return data.id;
}
