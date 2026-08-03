import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

/* ============ Tipos ============ */

export interface DealBlocker {
  id: string;
  label: string;
  description: string | null;
  defaultResolutionDays: number;
  position: number;
  isActive: boolean;
}

export interface DealLossReason {
  id: string;
  label: string;
  description: string | null;
  position: number;
  isActive: boolean;
}

function mapBlocker(r: any): DealBlocker {
  return {
    id: r.id,
    label: r.label,
    description: r.description ?? null,
    defaultResolutionDays: r.default_resolution_days ?? 7,
    position: r.position ?? 0,
    isActive: !!r.is_active,
  };
}

function mapLossReason(r: any): DealLossReason {
  return {
    id: r.id,
    label: r.label,
    description: r.description ?? null,
    position: r.position ?? 0,
    isActive: !!r.is_active,
  };
}

/* ============ Catálogos ============ */

export function useDealBlockers() {
  return useQuery({
    queryKey: ["deal-blockers"],
    queryFn: async (): Promise<DealBlocker[]> => {
      const { data, error } = await (supabase as any)
        .from("deal_blockers")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapBlocker);
    },
  });
}

export function useDealLossReasons() {
  return useQuery({
    queryKey: ["deal-loss-reasons"],
    queryFn: async (): Promise<DealLossReason[]> => {
      const { data, error } = await (supabase as any)
        .from("deal_loss_reasons")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapLossReason);
    },
  });
}

export function useUpsertBlocker() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: Partial<DealBlocker> & { id?: string }) => {
      const row: any = {
        label: input.label,
        description: input.description ?? null,
        default_resolution_days: input.defaultResolutionDays ?? 7,
        position: input.position ?? 99,
        is_active: input.isActive ?? true,
      };
      if (input.id) {
        const { error } = await (supabase as any).from("deal_blockers").update(row).eq("id", input.id);
        if (error) throw error;
      } else {
        if (!tenantId) throw new Error("No hay tenant activo");
        const { error } = await (supabase as any).from("deal_blockers").insert({ ...row, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-blockers"] }),
  });
}

export function useDeleteBlocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("deal_blockers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-blockers"] }),
  });
}

export function useUpsertLossReason() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: Partial<DealLossReason> & { id?: string }) => {
      const row: any = {
        label: input.label,
        description: input.description ?? null,
        position: input.position ?? 99,
        is_active: input.isActive ?? true,
      };
      if (input.id) {
        const { error } = await (supabase as any).from("deal_loss_reasons").update(row).eq("id", input.id);
        if (error) throw error;
      } else {
        if (!tenantId) throw new Error("No hay tenant activo");
        const { error } = await (supabase as any).from("deal_loss_reasons").insert({ ...row, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-loss-reasons"] }),
  });
}

export function useDeleteLossReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("deal_loss_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-loss-reasons"] }),
  });
}

export function useSeedDealDiagnostics() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { error } = await (supabase as any).rpc("seed_default_deal_diagnostics", { _tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-blockers"] });
      qc.invalidateQueries({ queryKey: ["deal-loss-reasons"] });
    },
  });
}

/* ============ Umbral de silencio ============ */

export function useNoResponseDays() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["no-response-days", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any)
        .from("tenants")
        .select("no_response_days")
        .eq("id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data?.no_response_days ?? 10;
    },
  });
}

export function useSetNoResponseDays() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (days: number) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { error } = await (supabase as any)
        .from("tenants")
        .update({ no_response_days: days })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["no-response-days"] }),
  });
}

/* ============ Estado vigente de una oportunidad ============ */

export interface DealDiagnosticState {
  currentBlockerId: string | null;
  blockerSetAt: string | null;
  blockerExpectedAt: string | null;
  blockerNote: string | null;
  lossReasonId: string | null;
  lastInboundAt: string | null;
  noResponseSince: string | null;
  lastKnownBlockerId: string | null;
}

export function useDealDiagnostic(dealId?: string | null) {
  return useQuery({
    queryKey: ["deal-diagnostic", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealDiagnosticState | null> => {
      const { data, error } = await (supabase as any)
        .from("deals")
        .select(
          "current_blocker_id, blocker_set_at, blocker_expected_at, blocker_note, loss_reason_id, last_inbound_at, no_response_since, last_known_blocker_id",
        )
        .eq("id", dealId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        currentBlockerId: data.current_blocker_id,
        blockerSetAt: data.blocker_set_at,
        blockerExpectedAt: data.blocker_expected_at,
        blockerNote: data.blocker_note,
        lossReasonId: data.loss_reason_id,
        lastInboundAt: data.last_inbound_at,
        noResponseSince: data.no_response_since,
        lastKnownBlockerId: data.last_known_blocker_id,
      };
    },
  });
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/* ============ Reporte "Por qué no avanzan" ============ */

export interface DiagnosticsRow {
  id: string;
  name: string;
  amount: number;
  ownerId: string | null;
  stageId: string | null;
  stageName: string;
  isWon: boolean;
  isLost: boolean;
  currentBlockerId: string | null;
  lastKnownBlockerId: string | null;
  blockerSetAt: string | null;
  blockerExpectedAt: string | null;
  lossReasonId: string | null;
  noResponseSince: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useDiagnosticsDeals() {
  return useQuery({
    queryKey: ["diagnostics-deals"],
    queryFn: async (): Promise<DiagnosticsRow[]> => {
      const { data, error } = await (supabase as any)
        .from("deals")
        .select(
          "id, name, amount, owner_id, stage_id, stage_name, is_won, is_lost, current_blocker_id, last_known_blocker_id, blocker_set_at, blocker_expected_at, loss_reason_id, no_response_since, created_at, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount ?? 0),
        ownerId: r.owner_id,
        stageId: r.stage_id,
        stageName: r.stage_name ?? "—",
        isWon: !!r.is_won,
        isLost: !!r.is_lost,
        currentBlockerId: r.current_blocker_id,
        lastKnownBlockerId: r.last_known_blocker_id,
        blockerSetAt: r.blocker_set_at,
        blockerExpectedAt: r.blocker_expected_at,
        lossReasonId: r.loss_reason_id,
        noResponseSince: r.no_response_since,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    },
  });
}