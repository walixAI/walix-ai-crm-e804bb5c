import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./tenant";

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "yearly";

export interface RecurrenceDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  interval: number;
  anticipation_days: number;
  action_type: string;
  payload: Record<string, any>;
  assigned_to: string | null;
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
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
        .select("*, assigned:assigned_to(full_name)")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (RecurrenceDefinition & { assigned?: { full_name: string } | null })[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateRecurrence = () => {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  return useMutation({
    mutationFn: async (input: Partial<RecurrenceDefinition>) => {
      const { data, error } = await supabase
        .from("recurrence_definitions")
        .insert({ ...input, tenant_id: tenant?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
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
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
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
