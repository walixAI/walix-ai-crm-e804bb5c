type CallActivity = {
  id: string;
  type: string;
  description?: string | null;
  occurred_at: string;
  tenant_id?: string;
  contact_id?: string | null;
  metadata?: unknown;
};

function metadata(row: CallActivity): Record<string, any> {
  return row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, any> : {};
}

/**
 * Hubo conversación si el proveedor reportó duración, si la llamada quedó conectada
 * o si existe transcripción/resumen de esa pierna. Sin eso es solo un intento.
 */
export function isEffectiveCall(autoMeta: Record<string, any>, summary = ""): boolean {
  const duration = Number(autoMeta.duration);
  if (Number.isFinite(duration) && duration > 0) return true;
  if (autoMeta.status === "answered") return true;
  if ((autoMeta.status === "completed" || autoMeta.status === "answered") && String(summary ?? "").trim()) return true;
  return false;
}

/** One visible attempt; raw automatic, AI and advisor records remain intact for audit. */
export function consolidateCallActivities<T extends CallActivity>(rows: T[], calls: { id: string; tenant_id: string; contact_id: string | null; hangup_by: string | null; hangup_at: string | null; ended_at: string | null }[] = []): T[] {
  const callEvidence = new Map(calls.map(c => [JSON.stringify([c.tenant_id, c.contact_id, c.id]), c]));
  const groups = new Map<string, T[]>();
  const result: T[] = [];
  for (const row of rows) {
    const m = metadata(row);
    if (typeof m.call_id !== "string" || !m.call_id || !["automatic_call_result", "call_analysis", "advisor_call_follow_up"].includes(m.source)) {
      result.push(row); continue;
    }
    const key = JSON.stringify([row.tenant_id, row.contact_id, m.call_id]);
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key, group);
  }
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
    const advisor = ordered.find((r) => metadata(r).source === "advisor_call_follow_up");
    const automatic = ordered.find((r) => metadata(r).source === "automatic_call_result");
    const analysis = ordered.find((r) => metadata(r).source === "call_analysis");
    const representative = advisor ?? automatic ?? ordered[0];
    if (!representative) continue;
    const autoMeta = automatic ? metadata(automatic) : {};
    const advisorMeta = advisor ? metadata(advisor) : {};
    const summary = analysis?.description?.replace(/^📞\s*Resumen IA de la llamada:\s*/, "") ?? "";
    result.push({
      ...representative,
      type: "call",
      description: advisor?.description || automatic?.description || "Llamada",
      occurred_at: automatic?.occurred_at ?? representative.occurred_at,
      metadata: {
        ...autoMeta, ...advisorMeta,
        call_id: metadata(representative).call_id,
        source: "consolidated_call",
        status: autoMeta.status,
        duration: autoMeta.duration,
        is_effective: isEffectiveCall(autoMeta, summary),
        automatic_result: autoMeta.result,
        result: advisorMeta.result ?? autoMeta.result,
        ai_summary: summary,
        related_activity_ids: ordered.map((r) => r.id),
        advisor_notes: advisor?.description ?? null,
        // Read the authoritative call, never a manual follow-up's claimed initiator.
        hangup_by: callEvidence.get(JSON.stringify([representative.tenant_id, representative.contact_id, metadata(representative).call_id]))?.hangup_by ?? null,
        hangup_at: callEvidence.get(JSON.stringify([representative.tenant_id, representative.contact_id, metadata(representative).call_id]))?.hangup_at ?? null,
        ended_at: callEvidence.get(JSON.stringify([representative.tenant_id, representative.contact_id, metadata(representative).call_id]))?.ended_at ?? null,
      },
    });
  }
  return result.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
}