import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";
import type { TriggerType, AutomationCondition, AutomationAction } from "@/lib/automations/registry";

export interface Automation {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  icon: string;
  enabled: boolean;
  isDraft: boolean;
  triggerType: TriggerType;
  triggerConfig: Record<string, any>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  entityType: string | null;
  entityId: string | null;
  status: "success" | "error" | "dry_run";
  mode: "live" | "dry";
  errorMessage: string | null;
  payload: any;
  createdAt: string;
}

function mapAutomation(r: any): Automation {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    description: r.description,
    icon: r.icon ?? "zap",
    enabled: !!r.enabled,
    isDraft: !!r.is_draft,
    triggerType: r.trigger_type,
    triggerConfig: r.trigger_config ?? {},
    conditions: Array.isArray(r.conditions) ? r.conditions : [],
    actions: Array.isArray(r.actions) ? r.actions : [],
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastRunAt: r.last_run_at,
    runCount: r.run_count ?? 0,
    errorCount: r.error_count ?? 0,
    lastError: r.last_error,
  };
}

export function useAutomations() {
  return useQuery({
    queryKey: ["automations"],
    queryFn: async (): Promise<Automation[]> => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapAutomation);
    },
  });
}

export interface CreateAutomationInput {
  name: string;
  description?: string;
  icon?: string;
  enabled?: boolean;
  isDraft?: boolean;
  triggerType: TriggerType;
  triggerConfig?: Record<string, any>;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateAutomationInput) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { data, error } = await supabase
        .from("automations")
        .insert({
          tenant_id: tenantId,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? "zap",
          enabled: input.enabled ?? false,
          is_draft: input.isDraft ?? false,
          trigger_type: input.triggerType,
          trigger_config: input.triggerConfig ?? {},
          conditions: input.conditions ?? [],
          actions: input.actions,
          created_by: user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapAutomation(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: Partial<CreateAutomationInput> & { enabled?: boolean; isDraft?: boolean } }) => {
      const dbPatch: any = {};
      const p = args.patch;
      if (p.name !== undefined) dbPatch.name = p.name;
      if (p.description !== undefined) dbPatch.description = p.description;
      if (p.icon !== undefined) dbPatch.icon = p.icon;
      if (p.enabled !== undefined) dbPatch.enabled = p.enabled;
      if (p.isDraft !== undefined) dbPatch.is_draft = p.isDraft;
      if (p.triggerType !== undefined) dbPatch.trigger_type = p.triggerType;
      if (p.triggerConfig !== undefined) dbPatch.trigger_config = p.triggerConfig;
      if (p.conditions !== undefined) dbPatch.conditions = p.conditions;
      if (p.actions !== undefined) dbPatch.actions = p.actions;
      const { error } = await supabase.from("automations").update(dbPatch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("automations").update({ enabled: args.enabled }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useDuplicateAutomation() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (a: Automation) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { error } = await supabase.from("automations").insert({
        tenant_id: tenantId,
        name: `${a.name} (copia)`,
        description: a.description,
        icon: a.icon,
        enabled: false,
        is_draft: a.isDraft,
        trigger_type: a.triggerType,
        trigger_config: a.triggerConfig,
        conditions: a.conditions,
        actions: a.actions,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useAutomationRuns(automationId: string | undefined) {
  return useQuery({
    queryKey: ["automation-runs", automationId],
    enabled: !!automationId,
    queryFn: async (): Promise<AutomationRun[]> => {
      const { data, error } = await supabase
        .from("automation_runs")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        automationId: r.automation_id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        status: r.status,
        mode: r.mode,
        errorMessage: r.error_message,
        payload: r.payload,
        createdAt: r.created_at,
      }));
    },
  });
}