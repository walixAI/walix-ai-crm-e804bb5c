import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers, type TenantUser } from "@/lib/queries/tenantUsers";
import type { ReportFilters } from "@/lib/reports/filters";

// ─────────────────────────────────────────────────────────────────
// Period helpers
// ─────────────────────────────────────────────────────────────────

export interface PeriodRange {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

export function resolvePeriodRange(p: ReportFilters["period"]): PeriodRange {
  const now = new Date();
  let from: Date;
  const to: Date = new Date(now);

  switch (p.preset) {
    case "today": {
      from = new Date(now); from.setHours(0, 0, 0, 0); break;
    }
    case "week": {
      from = new Date(now); from.setDate(now.getDate() - 7); break;
    }
    case "month": {
      from = new Date(now); from.setDate(now.getDate() - 30); break;
    }
    case "quarter": {
      from = new Date(now); from.setDate(now.getDate() - 90); break;
    }
    case "custom": {
      from = p.from ? new Date(p.from) : new Date(now.getTime() - 30 * 86400_000);
      const t   = p.to   ? new Date(p.to)   : now;
      const span = t.getTime() - from.getTime();
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - span);
      return { from, to: t, prevFrom, prevTo };
    }
  }

  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from, to, prevFrom, prevTo };
}

// ─────────────────────────────────────────────────────────────────
// Raw fetch — one query per range
// ─────────────────────────────────────────────────────────────────

interface RawDataset {
  deals: Array<{
    id: string;
    name: string;
    amount: number;
    owner_id: string | null;
    contact_id: string | null;
    stage_id: string | null;
    stage_name: string | null;
    is_won: boolean;
    is_lost: boolean;
    lost_reason: string | null;
    source: string;
    created_at: string;
    updated_at: string;
    won_at?: string | null;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    last_name: string | null;
    owner_id: string | null;
    source: string;
    status: string;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    deal_id: string | null;
    contact_id: string | null;
    agent_id: string | null;
    occurred_at: string;
  }>;
  stageHistory: Array<{
    deal_id: string;
    from_stage_name: string | null;
    to_stage_name: string | null;
    changed_by: string | null;
    changed_at: string;
  }>;
  stages: Array<{ id: string; name: string; position: number; is_won: boolean; is_lost: boolean }>;
}

async function fetchRange(tenantId: string, from: Date, to: Date): Promise<RawDataset> {
  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  const [deals, contacts, activities, stageHistory, stages] = await Promise.all([
    supabase.from("deals")
      .select("id, name, amount, owner_id, contact_id, stage_id, stage_name, is_won, is_lost, lost_reason, source, created_at, updated_at, won_at")
      .eq("tenant_id", tenantId)
      .or(`and(created_at.gte.${fromISO},created_at.lte.${toISO}),and(won_at.gte.${fromISO},won_at.lte.${toISO})`),
    supabase.from("contacts")
      .select("id, name, last_name, owner_id, source, status, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromISO).lte("created_at", toISO),
    supabase.from("activities")
      .select("id, type, deal_id, contact_id, agent_id, occurred_at")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", fromISO).lte("occurred_at", toISO),
    supabase.from("deal_stage_history")
      .select("deal_id, from_stage_name, to_stage_name, changed_by, changed_at")
      .eq("tenant_id", tenantId)
      .gte("changed_at", fromISO).lte("changed_at", toISO),
    supabase.from("pipeline_stages")
      .select("id, name, position, is_won, is_lost")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true }),
  ]);

  if (deals.error)        throw deals.error;
  if (contacts.error)     throw contacts.error;
  if (activities.error)   throw activities.error;
  if (stageHistory.error) throw stageHistory.error;
  if (stages.error)       throw stages.error;

  return {
    deals:        (deals.data        ?? []) as RawDataset["deals"],
    contacts:     (contacts.data     ?? []) as RawDataset["contacts"],
    activities:   (activities.data   ?? []) as RawDataset["activities"],
    stageHistory: (stageHistory.data ?? []) as RawDataset["stageHistory"],
    stages:       (stages.data       ?? []) as RawDataset["stages"],
  };
}

// ─────────────────────────────────────────────────────────────────
// Public hook
// ─────────────────────────────────────────────────────────────────

export interface ReportKpi {
  id: "revenue" | "pipeline" | "closeRate" | "cycle";
  label: string;
  value: string;
  rawValue: number;
  delta: number;
  hint: string;
}

export interface FunnelStageRow {
  id: string;
  name: string;
  count: number;
  value: number;
  conversionFromPrev: number | null;
}

export interface SellerPerformanceRow {
  sellerId: string;
  leadsAssigned: number;
  activeDeals: number;
  closedDeals: number;
  revenueGenerated: number;
  avgCloseDays: number;
  closeRate: number;
}

export interface SellerDealRow {
  id: string;
  contact: string;
  stage: string;
  amount: number;
  status: "active" | "won" | "lost";
  daysInStage: number;
}

export interface LeadSourceRow {
  id: string;
  name: string;
  count: number;
  revenue: number;
  color: string;
}

export interface LostReasonRow {
  id: string;
  reason: string;
  count: number;
  amount: number;
}

export interface HeatmapCellRow {
  whatsapp: number;
  notes: number;
  dealsMoved: number;
}

export interface StageConversionRow {
  from: string;
  to: string;
  advanced: number;
  rate: number;
}

export interface ReportsData {
  kpis: ReportKpi[];
  funnel: FunnelStageRow[];
  sellerPerformance: SellerPerformanceRow[];
  sellerDeals: Record<string, SellerDealRow[]>;
  leadSources: LeadSourceRow[];
  lostReasons: LostReasonRow[];
  lostTotal: number;
  heatmap: Record<string, HeatmapCellRow[]>;
  heatmapDays: readonly string[];
  stageConversions: StageConversionRow[];
  isEmpty: boolean;
}

const HEATMAP_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const SOURCE_COLORS: Record<string, string> = {
  WhatsApp: "#25D366",
  "Formulario web": "#4F46E5",
  Referido: "#06B6D4",
  Manual: "#64748B",
  "Redes sociales": "#EC4899",
  Other: "#94A3B8",
};

const SOURCE_LABELS: Record<string, string> = {
  WhatsApp: "WhatsApp",
  Web: "Formulario web",
  Referral: "Referido",
  Manual: "Manual",
  Social: "Redes sociales",
};

function fmtMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(n);
}

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function dayIndex(d: Date): number {
  // Monday = 0 ... Sunday = 6
  const js = d.getDay(); // 0=Sun
  return js === 0 ? 6 : js - 1;
}

function deriveData(
  curr: RawDataset,
  prev: RawDataset,
  users: TenantUser[],
  sellersFilter: string[],
): ReportsData {
  const filterUser = (id: string | null) =>
    sellersFilter.length === 0 || (id !== null && sellersFilter.includes(id));

  const deals      = curr.deals.filter(d => filterUser(d.owner_id));
  const contacts   = curr.contacts.filter(c => filterUser(c.owner_id));
  const activities = curr.activities.filter(a => filterUser(a.agent_id));
  const history    = curr.stageHistory.filter(h => filterUser(h.changed_by));

  const prevDeals = prev.deals.filter(d => filterUser(d.owner_id));

  // ── KPIs ──────────────────────────────────────────────
  const wonDeals = deals.filter(d => d.is_won);
  const revenue = wonDeals.reduce((s, d) => s + Number(d.amount || 0), 0);
  const prevWon = prevDeals.filter(d => d.is_won);
  const prevRevenue = prevWon.reduce((s, d) => s + Number(d.amount || 0), 0);

  const activeDeals = deals.filter(d => !d.is_won && !d.is_lost);
  const pipelineActive = activeDeals.reduce((s, d) => s + Number(d.amount || 0), 0);
  const prevActive = prevDeals.filter(d => !d.is_won && !d.is_lost);
  const prevPipeline = prevActive.reduce((s, d) => s + Number(d.amount || 0), 0);

  const closedTotal = wonDeals.length + deals.filter(d => d.is_lost).length;
  const closeRate = closedTotal === 0 ? 0 : Math.round((wonDeals.length / closedTotal) * 100);
  const prevClosedTotal = prevWon.length + prevDeals.filter(d => d.is_lost).length;
  const prevCloseRate = prevClosedTotal === 0 ? 0 : Math.round((prevWon.length / prevClosedTotal) * 100);

  const cycleDays = (arr: typeof wonDeals) => {
    if (arr.length === 0) return 0;
    const total = arr.reduce((s, d) => {
      const days = (new Date(d.won_at ?? d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400_000;
      return s + Math.max(0, days);
    }, 0);
    return Math.round(total / arr.length);
  };
  const cycle = cycleDays(wonDeals);
  const prevCycle = cycleDays(prevWon);

  const kpis: ReportKpi[] = [
    { id: "revenue",   label: "Revenue cerrado", value: fmtMXN(revenue),        rawValue: revenue,        delta: pctDelta(revenue, prevRevenue),       hint: "vs período anterior" },
    { id: "pipeline",  label: "Pipeline activo", value: fmtMXN(pipelineActive), rawValue: pipelineActive, delta: pctDelta(pipelineActive, prevPipeline), hint: "vs período anterior" },
    { id: "closeRate", label: "Tasa de cierre",  value: `${closeRate}%`,        rawValue: closeRate,      delta: closeRate - prevCloseRate,             hint: `${closeRate - prevCloseRate >= 0 ? "+" : ""}${closeRate - prevCloseRate} pts vs anterior` },
    { id: "cycle",     label: "Ciclo promedio",  value: `${cycle} días`,        rawValue: cycle,          delta: prevCycle === 0 ? 0 : Math.round(((cycle - prevCycle) / prevCycle) * 100), hint: "vs período anterior" },
  ];

  // ── Funnel ────────────────────────────────────────────
  const stagesOrdered = [...curr.stages].sort((a, b) => a.position - b.position);
  const dealsByStage = new Map<string, typeof deals>();
  for (const d of deals) {
    const key = d.stage_id ?? "__none";
    const arr = dealsByStage.get(key) ?? [];
    arr.push(d);
    dealsByStage.set(key, arr);
  }
  const funnel: FunnelStageRow[] = stagesOrdered.map((s, i) => {
    const arr = dealsByStage.get(s.id) ?? [];
    const count = arr.length;
    const value = arr.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const prev = i > 0 ? (dealsByStage.get(stagesOrdered[i - 1].id)?.length ?? 0) : 0;
    const conv = i === 0 ? null : prev === 0 ? 0 : Math.round((count / prev) * 100);
    return { id: s.id, name: s.name, count, value, conversionFromPrev: conv };
  });

  // ── Seller performance ───────────────────────────────
  const usersToShow = sellersFilter.length === 0
    ? users
    : users.filter(u => sellersFilter.includes(u.id));

  const sellerPerformance: SellerPerformanceRow[] = usersToShow.map(u => {
    const userDeals    = deals.filter(d => d.owner_id === u.id);
    const userContacts = contacts.filter(c => c.owner_id === u.id);
    const userClosed   = userDeals.filter(d => d.is_won);
    const userLost     = userDeals.filter(d => d.is_lost);
    const totalClosed  = userClosed.length + userLost.length;
    return {
      sellerId: u.id,
      leadsAssigned: userContacts.length,
      activeDeals: userDeals.filter(d => !d.is_won && !d.is_lost).length,
      closedDeals: userClosed.length,
      revenueGenerated: userClosed.reduce((s, d) => s + Number(d.amount || 0), 0),
      avgCloseDays: cycleDays(userClosed),
      closeRate: totalClosed === 0 ? 0 : Math.round((userClosed.length / totalClosed) * 100),
    };
  });

  const contactName = (id: string | null) => {
    if (!id) return "Sin contacto";
    const c = curr.contacts.find(x => x.id === id);
    return c ? `${c.name}${c.last_name ? " " + c.last_name : ""}` : "Contacto";
  };

  const sellerDeals: Record<string, SellerDealRow[]> = {};
  for (const u of usersToShow) {
    sellerDeals[u.id] = deals
      .filter(d => d.owner_id === u.id)
      .slice(0, 20)
      .map(d => ({
        id: d.id,
        contact: contactName(d.contact_id),
        stage: d.stage_name ?? "—",
        amount: Number(d.amount || 0),
        status: d.is_won ? "won" : d.is_lost ? "lost" : "active",
        daysInStage: Math.max(0, Math.round((Date.now() - new Date(d.updated_at).getTime()) / 86400_000)),
      }));
  }

  // ── Lead sources ─────────────────────────────────────
  const sourceMap = new Map<string, { count: number; revenue: number }>();
  for (const c of contacts) {
    const label = SOURCE_LABELS[c.source] ?? c.source ?? "Manual";
    const cur = sourceMap.get(label) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    sourceMap.set(label, cur);
  }
  for (const d of wonDeals) {
    const label = SOURCE_LABELS[d.source] ?? d.source ?? "Manual";
    const cur = sourceMap.get(label) ?? { count: 0, revenue: 0 };
    cur.revenue += Number(d.amount || 0);
    sourceMap.set(label, cur);
  }
  const leadSources: LeadSourceRow[] = Array.from(sourceMap.entries())
    .map(([name, v]) => ({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      count: v.count,
      revenue: v.revenue,
      color: SOURCE_COLORS[name] ?? SOURCE_COLORS.Other,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Lost reasons ─────────────────────────────────────
  const lostMap = new Map<string, { count: number; amount: number }>();
  for (const d of deals.filter(x => x.is_lost)) {
    const reason = (d.lost_reason ?? "Sin razón").trim() || "Sin razón";
    const cur = lostMap.get(reason) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += Number(d.amount || 0);
    lostMap.set(reason, cur);
  }
  const lostReasons: LostReasonRow[] = Array.from(lostMap.entries())
    .map(([reason, v]) => ({ id: reason, reason, ...v }))
    .sort((a, b) => b.count - a.count);
  const lostTotal = lostReasons.reduce((s, r) => s + r.amount, 0);

  // ── Heatmap (7 days × users) ─────────────────────────
  const heatmap: Record<string, HeatmapCellRow[]> = {};
  for (const u of usersToShow) {
    heatmap[u.id] = HEATMAP_DAYS.map(() => ({ whatsapp: 0, notes: 0, dealsMoved: 0 }));
  }
  for (const a of activities) {
    if (!a.agent_id || !heatmap[a.agent_id]) continue;
    const idx = dayIndex(new Date(a.occurred_at));
    const cell = heatmap[a.agent_id][idx];
    if (a.type === "whatsapp" || a.type === "message") cell.whatsapp += 1;
    else if (a.type === "note") cell.notes += 1;
  }
  for (const h of history) {
    if (!h.changed_by || !heatmap[h.changed_by]) continue;
    const idx = dayIndex(new Date(h.changed_at));
    heatmap[h.changed_by][idx].dealsMoved += 1;
  }

  // ── Stage conversions ────────────────────────────────
  const stageConversions: StageConversionRow[] = [];
  for (let i = 0; i < stagesOrdered.length - 1; i++) {
    const from = stagesOrdered[i];
    const to = stagesOrdered[i + 1];
    const advanced = history.filter(
      h => h.from_stage_name === from.name && h.to_stage_name === to.name,
    ).length;
    const fromCount = (dealsByStage.get(from.id) ?? []).length;
    const rate = fromCount === 0 ? 0 : Math.round((advanced / fromCount) * 100);
    stageConversions.push({ from: from.name, to: to.name, advanced, rate });
  }

  const isEmpty =
    deals.length === 0 && contacts.length === 0 && activities.length === 0;

  return {
    kpis, funnel, sellerPerformance, sellerDeals,
    leadSources, lostReasons, lostTotal,
    heatmap, heatmapDays: HEATMAP_DAYS,
    stageConversions, isEmpty,
  };
}

export function useReportsData(filters: ReportFilters) {
  const { data: tenantId } = useTenantId();
  const { data: users } = useTenantUsers();

  const range = useMemo(() => resolvePeriodRange(filters.period), [filters.period]);
  const sellersKey = filters.sellers.join(",");

  const query = useQuery({
    queryKey: ["reports", tenantId, range.from.toISOString(), range.to.toISOString()],
    enabled: !!tenantId && !!users,
    staleTime: 30_000,
    queryFn: async () => {
      const [curr, prev] = await Promise.all([
        fetchRange(tenantId!, range.from, range.to),
        fetchRange(tenantId!, range.prevFrom, range.prevTo),
      ]);
      return { curr, prev };
    },
  });

  const data = useMemo<ReportsData | null>(() => {
    if (!query.data || !users) return null;
    return deriveData(query.data.curr, query.data.prev, users, filters.sellers);
  }, [query.data, users, sellersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading: query.isLoading, error: query.error, users: users ?? [] };
}

export { HEATMAP_DAYS };