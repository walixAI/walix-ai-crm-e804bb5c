import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers, resolveOwner, type TenantUser } from "@/lib/queries/tenantUsers";

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  position: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  pipelineId: string | null;
}

export interface PipelineDeal {
  id: string;
  name: string;
  amount: number;
  probability: number;
  stageId: string | null;
  stageName: string;
  contactId: string | null;
  ownerId: string | null;
  ownerName: string;
  ownerInitials: string;
  ownerColor: string;
  expectedCloseDate: string | null;
  source: string;
  notes: string | null;
  isWon: boolean;
  isLost: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapDeal(r: any, users?: TenantUser[]): PipelineDeal {
  const owner = resolveOwner(users, r.owner_id);
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    probability: r.probability ?? 0,
    stageId: r.stage_id,
    stageName: r.stage_name ?? "—",
    contactId: r.contact_id,
    ownerId: r.owner_id,
    ownerName: owner.name,
    ownerInitials: owner.initials,
    ownerColor: owner.color,
    expectedCloseDate: r.expected_close_date,
    source: r.source ?? "Manual",
    notes: r.notes ?? null,
    isWon: !!r.is_won,
    isLost: !!r.is_lost,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function usePipelines() {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: async (): Promise<Pipeline[]> => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id, name: p.name, isDefault: !!p.is_default, position: p.position,
      }));
    },
  });
}

export function useStages(pipelineId?: string | null) {
  return useQuery({
    queryKey: ["pipeline-stages", pipelineId ?? "all"],
    queryFn: async (): Promise<PipelineStage[]> => {
      let query = supabase
        .from("pipeline_stages")
        .select("*")
        .order("position", { ascending: true });
      if (pipelineId) query = query.eq("pipeline_id", pipelineId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        color: s.color ?? "hsl(220 13% 65%)",
        isWon: !!s.is_won,
        isLost: !!s.is_lost,
        pipelineId: s.pipeline_id ?? null,
      }));
    },
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { data: existing } = await supabase
        .from("pipelines")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = (existing?.[0]?.position ?? -1) + 1;
      const { data, error } = await supabase
        .from("pipelines")
        .insert({ tenant_id: tenantId, name, is_default: false, position: nextPos })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipelines"] }),
  });
}

export function useRenamePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; name: string }) => {
      const { error } = await supabase.from("pipelines").update({ name: args.name }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipelines"] }),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipelines"] });
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
    },
  });
}

export interface StageHistoryRow {
  id: string;
  fromStageId: string | null;
  toStageId: string | null;
  fromStageName: string | null;
  toStageName: string | null;
  changedAt: string;
}

export function useStageHistory(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal-stage-history", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<StageHistoryRow[]> => {
      const { data, error } = await supabase
        .from("deal_stage_history")
        .select("*")
        .eq("deal_id", dealId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        fromStageId: r.from_stage_id,
        toStageId: r.to_stage_id,
        fromStageName: r.from_stage_name,
        toStageName: r.to_stage_name,
        changedAt: r.changed_at,
      }));
    },
  });
}

/**
 * Days the deal has been sitting in its current stage,
 * computed from the latest deal_stage_history entry. Falls back to deal.updatedAt.
 */
export function useDaysInCurrentStage(dealId: string | undefined, fallbackIso: string) {
  const { data: history } = useStageHistory(dealId);
  const lastChange = history?.[0]?.changedAt ?? fallbackIso;
  return daysSince(lastChange);
}

export function useDeals() {
  return useQuery({
    queryKey: ["pipeline-deals"],
    queryFn: async (): Promise<PipelineDeal[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDeal);
    },
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-deal", id],
    enabled: !!id,
    queryFn: async (): Promise<PipelineDeal | null> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDeal(data) : null;
    },
  });
}

export function useUpdateDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { dealId: string; stage: PipelineStage }) => {
      const { error } = await supabase
        .from("deals")
        .update({
          stage_id: args.stage.id,
          stage_name: args.stage.name,
          is_won: args.stage.isWon,
          is_lost: args.stage.isLost,
        })
        .eq("id", args.dealId);
      if (error) throw error;
    },
    onMutate: async ({ dealId, stage }) => {
      await qc.cancelQueries({ queryKey: ["pipeline-deals"] });
      const prev = qc.getQueryData<PipelineDeal[]>(["pipeline-deals"]);
      if (prev) {
        qc.setQueryData<PipelineDeal[]>(["pipeline-deals"], prev.map(d =>
          d.id === dealId
            ? { ...d, stageId: stage.id, stageName: stage.name, isWon: stage.isWon, isLost: stage.isLost, updatedAt: new Date().toISOString() }
            : d
        ));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline-deals"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipeline-deals"] }),
  });
}

export function useUpdateDealAmount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { dealId: string; amount: number }) => {
      const { error } = await supabase
        .from("deals")
        .update({ amount: args.amount })
        .eq("id", args.dealId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-deals"] }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { dealId: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("deals").update(args.patch as any).eq("id", args.dealId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deal", v.dealId] });
    },
  });
}

export interface NewDealInput {
  name: string;
  amount: number;
  probability: number;
  stageId: string;
  contactId: string | null;
  expectedCloseDate: string | null;
  source: string;
  notes: string | null;
}

export function useCreateDeal() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: NewDealInput) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("id, name, is_won, is_lost")
        .eq("id", input.stageId)
        .maybeSingle();
      const { data, error } = await supabase
        .from("deals")
        .insert({
          tenant_id: tenantId,
          name: input.name,
          amount: input.amount,
          probability: input.probability,
          stage_id: input.stageId,
          stage_name: stage?.name ?? null,
          contact_id: input.contactId,
          expected_close_date: input.expectedCloseDate,
          source: input.source as any,
          notes: input.notes,
          is_won: !!stage?.is_won,
          is_lost: !!stage?.is_lost,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-deals"] }),
  });
}

export interface DealTaskRow {
  id: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
}

export function useDealTasksMap() {
  return useQuery({
    queryKey: ["pipeline-deal-tasks-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, completed, due_at, deal_id")
        .not("deal_id", "is", null);
      if (error) throw error;
      const map = new Map<string, DealTaskRow[]>();
      for (const t of data ?? []) {
        const list = map.get(t.deal_id!) ?? [];
        list.push({ id: t.id, title: t.title, completed: t.completed, dueAt: t.due_at });
        map.set(t.deal_id!, list);
      }
      return map;
    },
  });
}

export function useUnreadByContactMap() {
  return useQuery({
    queryKey: ["pipeline-unread-by-contact"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("contact_id, unread_count");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const c of data ?? []) {
        map.set(c.contact_id, (map.get(c.contact_id) ?? 0) + (c.unread_count ?? 0));
      }
      return map;
    },
  });
}

export interface ContactLite { id: string; name: string; lastName: string | null; phone: string; avatarColor: string | null; lastActivityAt: string | null }
export function useContactsLite() {
  return useQuery({
    queryKey: ["pipeline-contacts-lite"],
    queryFn: async (): Promise<ContactLite[]> => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, last_name, phone, avatar_color, last_activity_at")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: c.id, name: c.name, lastName: c.last_name, phone: c.phone, avatarColor: c.avatar_color, lastActivityAt: c.last_activity_at,
      }));
    },
  });
}

export function useDealActivity(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal-activity", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("deal_id", dealId!)
        .order("occurred_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDealAiSuggestions(dealId: string | undefined, contactId: string | null | undefined) {
  return useQuery({
    queryKey: ["deal-ai", dealId, contactId],
    enabled: !!dealId,
    queryFn: async () => {
      // Prefer suggestions linked to the deal; fall back to suggestions for the related contact
      const { data: byDeal, error: e1 } = await supabase
        .from("ai_suggestions")
        .select("*")
        .eq("deal_id", dealId!)
        .eq("dismissed", false)
        .order("created_at", { ascending: false });
      if (e1) throw e1;
      if (byDeal && byDeal.length > 0) return byDeal;
      if (!contactId) return [];
      const { data: byContact, error: e2 } = await supabase
        .from("ai_suggestions")
        .select("*")
        .eq("contact_id", contactId)
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(3);
      if (e2) throw e2;
      return byContact ?? [];
    },
  });
}

export function formatMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
