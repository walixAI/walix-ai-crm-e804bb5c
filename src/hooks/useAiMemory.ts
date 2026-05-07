import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiMemory, type EntityType, type EventType } from "@/services/aiMemory";
import { useAuth } from "@/hooks/useAuth";

export function useEntityContext(entityType: EntityType | null, entityId: string | null) {
  return useQuery({
    queryKey: ["ai-entity-context", entityType, entityId],
    queryFn: () => aiMemory.getContext(entityType!, entityId!),
    enabled: !!entityType && !!entityId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useProactiveSuggestions() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-proactive-suggestions", userId],
    queryFn: () => aiMemory.getProactiveSuggestions(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const actOn = useMutation({
    mutationFn: ({ id, acted }: { id: string; acted: boolean }) =>
      aiMemory.actOnSuggestion(id, acted),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ai-proactive-suggestions", userId] }),
  });

  return {
    ...query,
    actOn: (id: string) => actOn.mutate({ id, acted: true }),
    dismiss: (id: string) => actOn.mutate({ id, acted: false }),
  };
}

export function useAiMemoryLogger() {
  return useCallback(
    (entityType: EntityType, entityId: string, eventType: EventType, data: Record<string, any> = {}) =>
      aiMemory.logEvent(entityType, entityId, eventType, data),
    []
  );
}