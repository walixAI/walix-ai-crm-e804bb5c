import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers, resolveOwner, type TenantUser } from "@/lib/queries/tenantUsers";
import { aiMemory } from "@/services/aiMemory";
import { toast } from "sonner";
import { fetchNextServiceDates, formatServiceMonths } from "@/lib/queries/recurrence";

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
  productCategoryId: string | null;
  serviceFrequencyMonths: number | null;
  createdAt: string;
  updatedAt: string;
  /** Fecha real en que se marcó como ganada (null si no está ganada). */
  wonAt: string | null;
  /* Diagnóstico de por qué no avanza */
  currentBlockerId: string | null;
  blockerSetAt: string | null;
  blockerExpectedAt: string | null;
  noResponseSince: string | null;
  lastKnownBlockerId: string | null;
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
    productCategoryId: r.product_category_id ?? null,
    serviceFrequencyMonths: r.service_frequency_months ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    wonAt: r.won_at ?? null,
    currentBlockerId: r.current_blocker_id ?? null,
    blockerSetAt: r.blocker_set_at ?? null,
    blockerExpectedAt: r.blocker_expected_at ?? null,
    noResponseSince: r.no_response_since ?? null,
    lastKnownBlockerId: r.last_known_blocker_id ?? null,
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

export function useSetDefaultPipeline() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      // Solo puede haber un default por tenant; desmarcamos los demás primero.
      const { error: resetError } = await supabase
        .from("pipelines")
        .update({ is_default: false })
        .eq("tenant_id", tenantId);
      if (resetError) throw resetError;
      const { error } = await supabase
        .from("pipelines")
        .update({ is_default: true })
        .eq("id", id)
        .eq("tenant_id", tenantId);
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
  metadata: { automatic?: boolean; ruleId?: string; event?: string } | null;
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
        metadata: r.metadata,
      }));
    },
  });
}

/** Deals de un contacto en el mismo formato que usa el Pipeline (para reutilizar DealDrawer). */
export function useContactPipelineDeals(contactId: string | undefined) {
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["contact-pipeline-deals", contactId, users?.length ?? 0],
    enabled: !!contactId,
    queryFn: async (): Promise<PipelineDeal[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => mapDeal(r, users));
    },
  });
}

export interface ContactStageChange extends StageHistoryRow {
  dealId: string;
}

/** Historial de cambios de etapa de todos los deals de un contacto. */
export function useContactStageHistory(contactId: string | undefined) {
  const { data: deals = [] } = useContactPipelineDeals(contactId);
  const dealIds = deals.map((d) => d.id).sort();
  return useQuery({
    queryKey: ["contact-stage-history", contactId, dealIds.join(",")],
    enabled: !!contactId && dealIds.length > 0,
    queryFn: async (): Promise<ContactStageChange[]> => {
      const { data, error } = await supabase
        .from("deal_stage_history")
        .select("*")
        .in("deal_id", dealIds)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        dealId: r.deal_id,
        fromStageId: r.from_stage_id,
        toStageId: r.to_stage_id,
        fromStageName: r.from_stage_name,
        toStageName: r.to_stage_name,
        changedAt: r.changed_at,
        metadata: r.metadata,
      }));
    },
  });
}

export interface PipelineStageRule {
  id: string;
  pipelineId: string;
  fromStageId: string;
  toStageId: string;
  triggerEvent: string;
  triggerFilters: Record<string, any>;
  isActive: boolean;
}

export function usePipelineStageRules(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-stage-rules", pipelineId],
    enabled: !!pipelineId,
    queryFn: async (): Promise<PipelineStageRule[]> => {
      const { data, error } = await supabase
        .from("pipeline_stage_rules")
        .select("*")
        .eq("pipeline_id", pipelineId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        pipelineId: r.pipeline_id,
        fromStageId: r.from_stage_id,
        toStageId: r.to_stage_id,
        triggerEvent: r.trigger_event,
        triggerFilters: r.trigger_filters ?? {},
        isActive: !!r.is_active,
      }));
    },
  });
}

export function useCreatePipelineStageRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<PipelineStageRule, "id" | "isActive"> & { tenantId: string }) => {
      const { error } = await supabase.from("pipeline_stage_rules").insert({
        tenant_id: payload.tenantId,
        pipeline_id: payload.pipelineId,
        from_stage_id: payload.fromStageId,
        to_stage_id: payload.toStageId,
        trigger_event: payload.triggerEvent,
        trigger_filters: payload.triggerFilters,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["pipeline-stage-rules", v.pipelineId] });
    },
  });
}

export function useDeletePipelineStageRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ruleId: string; pipelineId: string }) => {
      const { error } = await supabase.from("pipeline_stage_rules").delete().eq("id", args.ruleId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["pipeline-stage-rules", v.pipelineId] });
    },
  });
}

export function useSeedPipelineTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { tenantId: string; pipelineId: string; template: string }) => {
      const { data, error } = await supabase.rpc("seed_pipeline_template", {
        p_tenant_id: args.tenantId,
        p_pipeline_id: args.pipelineId,
        p_template_name: args.template,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipelines"] });
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      qc.invalidateQueries({ queryKey: ["pipeline-stage-rules"] });
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
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["pipeline-deals", users?.length ?? 0],
    queryFn: async (): Promise<PipelineDeal[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapDeal(r, users));
    },
  });
}

export function useDeal(id: string | undefined) {
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["pipeline-deal", id, users?.length ?? 0],
    enabled: !!id,
    queryFn: async (): Promise<PipelineDeal | null> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDeal(data, users) : null;
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
      void aiMemory.logEvent("deal", args.dealId, "deal_stage_changed", {
        stage_id: args.stage.id,
        stage_name: args.stage.name,
        is_won: args.stage.isWon,
        is_lost: args.stage.isLost,
      });
      // Si era un servicio recurrente, el ciclo se cierra solo: avisamos las próximas citas
      if (args.stage.isWon) {
        try {
          const dates = await fetchNextServiceDates(args.dealId);
          if (dates.length > 0) {
            toast.success(`Siguiente servicio programado: ${formatServiceMonths(dates)}`);
          }
        } catch { /* noop */ }
      }
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
  productCategoryId?: string | null;
}

/**
 * Marca una oportunidad como ganada permitiendo elegir la fecha real de cierre.
 * La fecha nunca puede ser futura (el trigger de la BD también lo valida).
 */
export function useMarkDealWon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { dealId: string; stage: PipelineStage; wonAt?: Date | null }) => {
      const now = new Date();
      const when = args.wonAt && args.wonAt < now ? args.wonAt : now;
      const { error } = await supabase
        .from("deals")
        .update({
          stage_id: args.stage.id,
          stage_name: args.stage.name,
          is_won: true,
          is_lost: false,
          probability: 100,
          won_at: when.toISOString(),
        } as any)
        .eq("id", args.dealId);
      if (error) throw error;
      void aiMemory.logEvent("deal", args.dealId, "deal_stage_changed", {
        stage_id: args.stage.id,
        stage_name: args.stage.name,
        is_won: true,
        won_at: when.toISOString(),
      });
      try {
        const dates = await fetchNextServiceDates(args.dealId);
        if (dates.length > 0) toast.success(`Siguiente servicio programado: ${formatServiceMonths(dates)}`);
      } catch { /* noop */ }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deal", v.dealId] });
      qc.invalidateQueries({ queryKey: ["run-rate"] });
    },
  });
}

interface NewDealInputUnused {
  name: string;
  amount: number;
  probability: number;
  stageId: string;
  contactId: string | null;
  expectedCloseDate: string | null;
  source: string;
  notes: string | null;
  productCategoryId?: string | null;
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
          product_category_id: input.productCategoryId ?? null,
          is_won: !!stage?.is_won,
          is_lost: !!stage?.is_lost,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, input) => {
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      if (data?.id) {
        void aiMemory.logEvent("deal", data.id, "deal_created", {
          name: input.name,
          amount: input.amount,
          contact_id: input.contactId,
        });
      }
    },
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

export interface ContactLite { id: string; name: string; lastName: string | null; phone: string; phoneAlt: string | null; email: string | null; address: string | null; company: string | null; avatarColor: string | null; lastActivityAt: string | null }
export function useContactsLite() {
  return useQuery({
    queryKey: ["pipeline-contacts-lite"],
    queryFn: async (): Promise<ContactLite[]> => {
      // PostgREST devuelve máximo 1000 filas por petición: paginamos para no
      // perder contactos (si faltan, las tarjetas del pipeline salen sin nombre).
      const PAGE = 1000;
      const rows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, name, last_name, phone, phone_alt, email, address, company, avatar_color, last_activity_at")
          .order("name")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return rows.map((c: any) => ({
        id: c.id, name: c.name, lastName: c.last_name, phone: c.phone, phoneAlt: c.phone_alt,
        email: c.email, address: c.address, company: c.company,
        avatarColor: c.avatar_color, lastActivityAt: c.last_activity_at,
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
