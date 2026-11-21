import { latestActiveOpportunity } from "@/lib/pipeline/currentOpportunity";

export const normalizeStageName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");

export interface ReportStage { id: string; name: string; position: number; pipeline_id?: string | null; is_won: boolean; is_lost: boolean }
export interface ReportDeal { id: string; stage_id: string | null; amount: number; contact_id?: string | null; created_at?: string; is_won?: boolean; is_lost?: boolean }
export interface ReportMovement { deal_id: string; from_stage_id?: string | null; to_stage_id?: string | null; from_stage_name: string | null; to_stage_name: string | null }

export function buildStageReports(stages: ReportStage[], deals: ReportDeal[], history: ReportMovement[]) {
  const groups = new Map<string, { id: string; name: string; pipelineId: string; stageIds: string[]; position: number }>();
  for (const stage of [...stages].sort((a,b) => a.position-b.position || a.id.localeCompare(b.id))) {
    const key = JSON.stringify([stage.pipeline_id ?? "", normalizeStageName(stage.name)]);
    const group = groups.get(key) ?? { id: stage.id, name: stage.name.trim(), pipelineId: stage.pipeline_id ?? "", stageIds: [], position: stage.position };
    if (!group.stageIds.includes(stage.id)) group.stageIds.push(stage.id);
    groups.set(key, group);
  }
  const ordered = [...groups.values()];
  const funnel = ordered.map(group => {
    const matches = [...new Map(deals.filter(d => d.stage_id && group.stageIds.includes(d.stage_id)).map(d => [d.id,d])).values()];
    return { ...group, count: matches.length, value: matches.reduce((sum,d) => sum+Number(d.amount || 0),0), conversionFromPrev: null };
  });
  const stageConversions: { from: string; to: string; pipelineId: string; advanced: number; eligible: number; rate: number }[] = [];
  for (const pipeline of new Set(ordered.map(s => s.pipelineId))) {
    const sequence = ordered.filter(s => s.pipelineId === pipeline);
    for (let i=0;i<sequence.length-1;i++) {
      const from=sequence[i], to=sequence[i+1];
      const matches = (id: string | null | undefined, name: string | null, group: typeof from) => id ? group.stageIds.includes(id) : !!name && normalizeStageName(name) === normalizeStageName(group.name) && stages.filter(s => normalizeStageName(s.name)===normalizeStageName(name)).every(s => (s.pipeline_id ?? "")===pipeline);
      const eligible = new Set(deals.filter(d => d.stage_id && from.stageIds.includes(d.stage_id)).map(d => d.id));
      const advanced = new Set<string>();
      for (const h of history) {
        const fromMatch=matches(h.from_stage_id,h.from_stage_name,from);
        if (fromMatch || matches(h.to_stage_id,h.to_stage_name,from)) eligible.add(h.deal_id);
        if (fromMatch && matches(h.to_stage_id,h.to_stage_name,to)) { advanced.add(h.deal_id); eligible.add(h.deal_id); }
      }
      stageConversions.push({ from: from.name, to: to.name, pipelineId: pipeline, advanced: advanced.size, eligible: eligible.size, rate: eligible.size ? Math.round(advanced.size/eligible.size*100) : 0 });
    }
  }
  return { funnel, stageConversions };
}

/** One lead row per contact: newest open opportunity, otherwise newest closed. */
export function uniqueLeadDeals<T extends ReportDeal>(deals: T[]): T[] {
  const groups=new Map<string,T[]>();
  for (const deal of deals) { const key=deal.contact_id ?? deal.id; const group=groups.get(key) ?? []; group.push(deal); groups.set(key,group); }
  return [...groups.values()].map(group => {
    const adapted=group.map(deal=>({deal,isWon:!!deal.is_won,isLost:!!deal.is_lost,createdAt:deal.created_at ?? ""}));
    return latestActiveOpportunity(adapted)?.deal ?? [...group].sort((a,b)=>Date.parse(b.created_at ?? "")-Date.parse(a.created_at ?? "") || b.id.localeCompare(a.id))[0];
  }).filter((d): d is T => !!d);
}

export const TEAM_ACTIVITY_TYPES = [
  ["all", "Todas las actividades"], ["inbound_call", "Llamada entrante"], ["outbound_call", "Llamada saliente"],
  ["call", "Llamada sin dirección registrada"], ["whatsapp", "WhatsApp"], ["email", "Email"], ["meeting", "Reunión"], ["note", "Nota"], ["task", "Tarea"], ["deal", "Cambio de etapa"], ["manual", "Otra actividad"],
] as const;
export function classifyTeamActivity(type: string, metadata: Record<string, unknown>, direction?: string | null) {
  if (type === "call") { const dir=direction ?? metadata.direction; return dir === "inbound" ? "inbound_call" : dir === "outbound" ? "outbound_call" : "call"; }
  if (["whatsapp","message","wa_sent","wa_received"].includes(type)) return "whatsapp";
  return TEAM_ACTIVITY_TYPES.some(([key]) => key===type) ? type : "manual";
}