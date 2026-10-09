import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export function usePipelineStagesForEmail() {
  const { data: tenantId } = useTenantId();
  const { data = [] } = useQuery({
    queryKey: ["email-stages", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages").select("id, name, position, pipelines:pipeline_id(name)").eq("tenant_id", tenantId!).order("position");
      return (data ?? []).map((s: any) => ({ id: s.id, label: s.pipelines?.name ? `${s.pipelines.name} · ${s.name}` : s.name }));
    },
  });
  return data;
}
