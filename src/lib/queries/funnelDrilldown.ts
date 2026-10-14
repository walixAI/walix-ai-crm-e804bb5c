import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface DrilldownFilters {
  from: string | null; // ISO date
  to: string | null;
  campaign: string | null;
  program: string | null;
  advisorId: string | null;
  /** latest = solo el seguimiento más reciente por oportunidad; all = todo el periodo */
  mode: "latest" | "all";
}

export interface FollowUpRow {
  activityId: string;
  dealId: string | null;
  contactId: string | null;
  contactName: string;
  advisorId: string | null;
  advisorName: string;
  occurredAt: string;
  stageName: string;
  stagePosition: number;
  program: string;
  outcomeLabel: string;
  typificationLabel: string;
  typificationSentiment: "positive" | "neutral" | "negative" | null;
  campaign: string;
  isWon: boolean;
  isLost: boolean;
}

function campaignOf(attr: any): string {
  if (!attr) return "Sin campaña";
  return (
    attr.utm_campaign || attr.ad_campaign_name || attr.meta_form_name || attr.utm_source || "Sin campaña"
  );
}

/** Seguimientos con resultado, enriquecidos con etapa, programa, campaña y asesor. */
export function useFunnelDrilldown(filters: DrilldownFilters) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["funnel-drilldown", tenantId, filters],
    enabled: !!tenantId,
    queryFn: async (): Promise<FollowUpRow[]> => {
      let q = (supabase as any)
        .from("activities")
        .select(
          "id, deal_id, contact_id, agent_id, occurred_at, metadata," +
          " deals:deal_id(name, is_won, is_lost, pipeline_stages:stage_id(name, position))," +
          " contacts:contact_id(name)",
        )
        .not("metadata->>result", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(5000);
      if (filters.from) q = q.gte("occurred_at", filters.from);
      if (filters.to) q = q.lte("occurred_at", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      const acts = data ?? [];

      const contactIds = [...new Set(acts.map((a: any) => a.contact_id).filter(Boolean))];
      const agentIds = [...new Set(acts.map((a: any) => a.agent_id).filter(Boolean))];

      const [attrRes, profRes] = await Promise.all([
        contactIds.length
          ? (supabase as any)
              .from("contact_attribution")
              .select("contact_id, utm_campaign, utm_source, ad_campaign_name, meta_form_name, touch_type, touched_at")
              .in("contact_id", contactIds)
              .order("touched_at", { ascending: true })
          : Promise.resolve({ data: [] }),
        agentIds.length
          ? (supabase as any).from("profiles").select("id, full_name, email").in("id", agentIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Primer toque de atribución por contacto (origen de la campaña).
      const attrByContact = new Map<string, any>();
      for (const a of attrRes.data ?? []) {
        if (!attrByContact.has(a.contact_id)) attrByContact.set(a.contact_id, a);
      }
      const nameByAgent = new Map<string, string>(
        (profRes.data ?? []).map((p: any) => [p.id, p.full_name || p.email || "Asesor"]),
      );

      let rows: FollowUpRow[] = acts.map((a: any) => {
        const md = a.metadata ?? {};
        return {
          activityId: a.id,
          dealId: a.deal_id,
          contactId: a.contact_id,
          contactName: a.contacts?.name ?? "Sin nombre",
          advisorId: a.agent_id,
          advisorName: nameByAgent.get(a.agent_id) ?? "Sin asesor",
          occurredAt: a.occurred_at,
          stageName: a.deals?.pipeline_stages?.name ?? "Sin etapa",
          stagePosition: a.deals?.pipeline_stages?.position ?? 999,
          program: a.deals?.name ?? "Sin oportunidad",
          outcomeLabel: md.result ?? "Sin resultado",
          typificationLabel: md.typification_label ?? "Sin tipificar",
          typificationSentiment: md.typification_sentiment ?? null,
          campaign: campaignOf(attrByContact.get(a.contact_id)),
          isWon: !!a.deals?.is_won,
          isLost: !!a.deals?.is_lost,
        };
      });

      if (filters.mode === "latest") {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const key = r.dealId ?? r.contactId ?? r.activityId;
          if (seen.has(key)) return false; // ya ordenado desc: el primero es el más reciente
          seen.add(key);
          return true;
        });
      }
      if (filters.campaign) rows = rows.filter((r) => r.campaign === filters.campaign);
      if (filters.program) rows = rows.filter((r) => r.program === filters.program);
      if (filters.advisorId) rows = rows.filter((r) => r.advisorId === filters.advisorId);
      return rows;
    },
  });
}

export interface DrillNode {
  key: string;
  label: string;
  count: number;
  sentiment?: "positive" | "neutral" | "negative" | null;
  children: DrillNode[];
}

/** Agrupa Etapa → Resultado → Tipificación. */
export function buildDrilldown(rows: FollowUpRow[]): DrillNode[] {
  const stages = new Map<string, DrillNode & { pos: number }>();
  for (const r of rows) {
    const sk = r.stageName;
    if (!stages.has(sk)) stages.set(sk, { key: sk, label: sk, count: 0, children: [], pos: r.stagePosition });
    const stage = stages.get(sk)!;
    stage.count++;
    let outcome = stage.children.find((c) => c.key === r.outcomeLabel);
    if (!outcome) {
      outcome = { key: r.outcomeLabel, label: r.outcomeLabel, count: 0, children: [] };
      stage.children.push(outcome);
    }
    outcome.count++;
    let typ = outcome.children.find((c) => c.key === r.typificationLabel);
    if (!typ) {
      typ = {
        key: r.typificationLabel,
        label: r.typificationLabel,
        count: 0,
        sentiment: r.typificationSentiment,
        children: [],
      };
      outcome.children.push(typ);
    }
    typ.count++;
  }
  const sort = (nodes: DrillNode[]) => nodes.sort((a, b) => b.count - a.count);
  return [...stages.values()]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => ({ ...s, children: sort(s.children).map((o) => ({ ...o, children: sort(o.children) })) }));
}

export interface CampaignMotivoRow {
  campaign: string;
  total: number;
  won: number;
  motivos: Map<string, number>;
}

/** Cruce Campaña × tipificaciones negativas + inscritos. */
export function buildCampaignMotivos(rows: FollowUpRow[]): CampaignMotivoRow[] {
  const map = new Map<string, CampaignMotivoRow>();
  for (const r of rows) {
    if (!map.has(r.campaign)) map.set(r.campaign, { campaign: r.campaign, total: 0, won: 0, motivos: new Map() });
    const row = map.get(r.campaign)!;
    row.total++;
    if (r.isWon || r.outcomeLabel.toLowerCase().includes("ganad")) row.won++;
    if (r.typificationSentiment === "negative") {
      row.motivos.set(r.typificationLabel, (row.motivos.get(r.typificationLabel) ?? 0) + 1);
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
