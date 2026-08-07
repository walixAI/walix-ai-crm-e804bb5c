import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./tenant";

export type RecurrenceKind = "periodic" | "calendar";

export interface RecurrenceAction {
  type: "create_task" | "create_deal" | "send_whatsapp" | "notify_owner";
  config?: Record<string, any>;
}

export interface RecurrenceDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  kind: RecurrenceKind;
  period_months: number | null;
  anticipation_days: number;
  target_pipeline_id: string | null;
  target_stage_id: string | null;
  actions: RecurrenceAction[];
  substitution_rule: Record<string, any>;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

export const useRecurrences = () => {
  const { data: tenant } = useTenant();
  return useQuery({
    queryKey: ["recurrences", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("recurrence_definitions")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RecurrenceDefinition[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateRecurrence = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async (input: Partial<RecurrenceDefinition>) => {
      const payload = { ...input, tenant_id: tenant?.id } as any;
      const { data, error } = await supabase
        .from("recurrence_definitions")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RecurrenceDefinition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrences", tenant?.id] }),
  });
};

export const useUpdateRecurrence = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<RecurrenceDefinition> & { id: string }) => {
      const { data, error } = await supabase
        .from("recurrence_definitions")
        .update(rest as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RecurrenceDefinition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrences", tenant?.id] }),
  });
};

export const useDeleteRecurrence = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurrence_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrences", tenant?.id] }),
  });
};
