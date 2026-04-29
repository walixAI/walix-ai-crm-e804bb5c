import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog } from "@/services/audit";

export function useAuditLog(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["audit-log", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchAuditLog(tenantId!),
    staleTime: 30_000,
  });
}