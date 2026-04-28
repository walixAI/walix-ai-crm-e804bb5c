import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useTenantId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tenant-id", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.tenant_id ?? null;
    },
  });
}