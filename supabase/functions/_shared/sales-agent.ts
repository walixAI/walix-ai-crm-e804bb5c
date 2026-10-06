// Núcleo del Agente de ventas por Pipeline: resolución de responsable, objetivo aplicable
// y construcción del contexto (identidad + conocimiento + objetivo) compartido por todos los canales.

export interface Condition { field: string; op?: string; value: any }

export interface LeadFacts {
  source?: string | null;
  tags?: string[];
  owner_id?: string | null;
  stage_id?: string | null;
  address?: string | null;
  score?: number;
  month?: number; // 1-12, para temporadas
}

function norm(v: any) { return String(v ?? "").trim().toLowerCase(); }

export function matchCondition(c: Condition, f: LeadFacts): boolean {
  const vals: any[] = Array.isArray(c.value) ? c.value : [c.value];
  switch (c.field) {
    case "source": return vals.some((v) => norm(v) === norm(f.source));
    case "tag": return vals.some((v) => (f.tags ?? []).map(norm).includes(norm(v)));
    case "owner_id": return vals.includes(f.owner_id);
    case "stage_id": return vals.includes(f.stage_id);
    case "city": return vals.some((v) => norm(f.address).includes(norm(v)));
    case "month": return vals.map(Number).includes(f.month ?? new Date().getMonth() + 1);
    case "score_min": return (f.score ?? 0) >= Number(vals[0] ?? 0);
    default: return false;
  }
}

export function matchAll(conds: Condition[] | null | undefined, f: LeadFacts) {
  const list = Array.isArray(conds) ? conds : [];
  return list.every((c) => matchCondition(c, f));
}

/** Elige UN responsable: más específico → prioridad → por defecto → null (asesor manual). */
export function resolveAgent<T extends { enabled: boolean; is_default: boolean; priority: number; assignment_conditions: any }>(
  agents: T[], f: LeadFacts,
): T | null {
  const active = agents.filter((a) => a.enabled);
  const specific = active
    .filter((a) => !a.is_default && Array.isArray(a.assignment_conditions) && a.assignment_conditions.length > 0)
    .filter((a) => matchAll(a.assignment_conditions, f))
    .sort((a, b) => (b.assignment_conditions.length - a.assignment_conditions.length) || (b.priority - a.priority));
  if (specific[0]) return specific[0];
  return active.find((a) => a.is_default) ?? null;
}

export function resolveGoal(agent: any, rules: any[], f: LeadFacts) {
  const rule = rules
    .filter((r) => r.active && matchAll(r.conditions, f))
    .sort((a, b) => b.priority - a.priority)[0];
  if (rule) {
    return { rule_id: rule.id, rule_name: rule.name, goal: rule.goal, key_message: rule.key_message,
      autonomy: rule.autonomy || agent.autonomy, allow_close: rule.allow_close };
  }
  return { rule_id: null, rule_name: null, goal: agent.default_goal, key_message: agent.default_key_message,
    autonomy: agent.autonomy, allow_close: agent.default_allow_close };
}

export async function loadLeadFacts(sb: any, contactId: string, pipelineId: string): Promise<LeadFacts> {
  const { data: c } = await sb.from("contacts").select("source, tags, owner_id, address").eq("id", contactId).maybeSingle();
  const { data: d } = await sb.from("deals").select("stage_id").eq("contact_id", contactId)
    .eq("pipeline_id", pipelineId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { source: c?.source, tags: c?.tags ?? [], owner_id: c?.owner_id, address: c?.address,
    stage_id: d?.stage_id ?? null, month: new Date().getMonth() + 1 };
}

export function buildSystemPrompt(agent: any, goal: ReturnType<typeof resolveGoal>, knowledge: any[], channel: string) {
  const kb = knowledge.slice(0, 40).map((k) => `### ${k.title || k.kind}\n${(k.content || "").slice(0, 2500)}${k.url ? `\nFuente: ${k.url}` : ""}`).join("\n\n");
  return [
    `Eres "${agent.name}", agente de ventas. ${agent.identity || ""}`,
    `Tono: ${agent.tone || "cercano y profesional"}. Idioma: ${agent.language || "es-MX"}.`,
    `Canal: ${channel}. Responde breve (máx. 3-4 oraciones), una pregunta a la vez.`,
    `OBJETIVO ACTUAL: ${goal.goal || "calificar al lead y agendar el siguiente paso"}.`,
    goal.key_message ? `Mensaje clave: ${goal.key_message}` : "",
    agent.never_do ? `NUNCA: ${agent.never_do}` : "",
    "Perfila al lead (necesidad, presupuesto, tiempo, decisor). Si piden hablar con una persona, hay una queja o no sabes la respuesta, indica que lo canalizas con un asesor.",
    "Usa solo la información de la base de conocimiento; no inventes precios ni fechas.",
    kb ? `\n## Base de conocimiento\n${kb}` : "",
  ].filter(Boolean).join("\n");
}
