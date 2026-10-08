/** Enriches one contact brief using stored facts; profile completeness is never close probability. */
export function enrichProspectBrief(brief: any, deals: any[], sessions: any[], agents: any[]) {
  const values = new Map<string, { key: string; label: string; value: string }>();
  for (const s of [...sessions].reverse()) {
    const agent = agents.find((a) => a.id === s.agent_id);
    for (const f of agent?.profiling_fields ?? []) {
      const value = s.profile_data?.[f.key];
      if (value !== undefined && value !== null && String(value).trim()) {
        values.set(f.key, { key: f.key, label: f.label, value: String(value) });
      }
    }
  }
  const probabilities = deals.map((d) => ({
    id: d.id, name: d.name,
    pct: d.is_won ? 100 : d.is_lost ? 0 : Math.max(0, Math.min(100, Number(d.probability) || 0)),
    reason: d.is_won ? "Oportunidad ganada." : d.is_lost ? "Oportunidad perdida." :
      (d.id === deals.find((x) => !x.is_won && !x.is_lost)?.id ? brief.close_probability?.reason : null) || "Probabilidad registrada en la oportunidad.",
  }));
  const primary = probabilities.find((d) => d.id === deals.find((x) => !x.is_won && !x.is_lost)?.id) ?? probabilities[0];
  return { ...brief, profile: [...values.values()], profile_completeness: sessions[0]?.score ?? null,
    deal_probabilities: primary ? [primary, ...probabilities.filter((d) => d.id !== primary.id)] : probabilities,
    close_probability: primary ? { pct: primary.pct, label: primary.pct >= 70 ? "Alta" : primary.pct >= 40 ? "Media" : "Baja", reason: primary.reason } : brief.close_probability,
  };
}