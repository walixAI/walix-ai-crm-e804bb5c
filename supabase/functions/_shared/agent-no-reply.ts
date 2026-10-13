/** Tenant-scoped operational alerts; deduplicate by recipient, conversation and reason. */
export async function notifyAgentNoReply(sb: any, p: {
  tenantId: string; contactId: string; conversationId: string; reason: string; why: string;
}) {
  const { data: contact } = await sb.from("contacts").select("name, owner_id")
    .eq("id", p.contactId).eq("tenant_id", p.tenantId).maybeSingle();
  const { data: conversation } = await sb.from("conversations").select("assignee_id")
    .eq("id", p.conversationId).eq("tenant_id", p.tenantId).maybeSingle();
  const recipients = new Set<string>();
  if (contact?.owner_id) recipients.add(contact.owner_id);
  if (conversation?.assignee_id) recipients.add(conversation.assignee_id);
  const { data: supervisors, error: rolesError } = await sb.from("user_roles").select("user_id")
    .eq("tenant_id", p.tenantId).in("role", ["tenant_admin", "tenant_owner", "sales_manager"]);
  if (rolesError) throw rolesError;
  for (const supervisor of supervisors ?? []) recipients.add(supervisor.user_id);
  if (!recipients.size) return;
  const { data: recent, error: recentError } = await sb.from("notifications").select("user_id")
    .eq("tenant_id", p.tenantId).eq("type", "agent_no_reply")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .contains("data", { conversation_id: p.conversationId, reason: p.reason });
  if (recentError) throw recentError;
  const notified = new Set((recent ?? []).map((n: any) => n.user_id));
  const rows = [...recipients].filter((id) => !notified.has(id)).map((userId) => ({
    tenant_id: p.tenantId, user_id: userId, category: "operational", severity: "danger",
    type: "agent_no_reply", icon: "AlertTriangle",
    title: p.reason === "tope_diario" ? "El bot alcanzó el límite diario de respuestas" : "Un mensaje quedó sin respuesta del agente",
    body: `${contact?.name ?? "Un lead"} escribió y el agente no contestó porque ${p.why}. El asesor debe continuar la conversación.`,
    link: `/whatsapp?conversationId=${p.conversationId}`,
    data: { reason: p.reason, conversation_id: p.conversationId, contact_id: p.contactId },
  }));
  if (rows.length) {
    const { error } = await sb.from("notifications").insert(rows);
    if (error) throw error;
  }
}