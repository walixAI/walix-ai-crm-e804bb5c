import { useEntityContext } from "./useAiMemory";
import type { EntityType } from "@/services/aiMemory";

export function useEntityUrgency(entityType: EntityType | null, entityId: string | null) {
  const { data } = useEntityContext(entityType, entityId);
  return {
    urgencyScore: data?.urgency_score ?? null,
    sentiment: data?.sentiment ?? null,
    summary: data?.context_summary ?? null,
  };
}