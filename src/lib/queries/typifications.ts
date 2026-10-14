import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export type TypificationSentiment = "positive" | "neutral" | "negative";

export interface OutcomeTypification {
  id: string;
  outcomeId: string | null;
  label: string;
  sentiment: TypificationSentiment;
  position: number;
  isActive: boolean;
}

function mapTyp(r: any): OutcomeTypification {
  return {
    id: r.id,
    outcomeId: r.outcome_id,
    label: r.label,
    sentiment: (r.sentiment ?? "neutral") as TypificationSentiment,
    position: r.position,
    isActive: !!r.is_active,
  };
}

/** Todas las tipificaciones del tenant (para Configuración). */
export function useOutcomeTypifications() {
  return useQuery({
    queryKey: ["outcome-typifications"],
    queryFn: async (): Promise<OutcomeTypification[]> => {
      const { data, error } = await (supabase as any)
        .from("outcome_typifications")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapTyp);
    },
  });
}

/** Tipificaciones aplicables a un resultado: las suyas + las globales (outcome_id nulo). */
export function typificationsForOutcome(
  all: OutcomeTypification[],
  outcomeId: string | null | undefined,
): OutcomeTypification[] {
  if (!outcomeId) return [];
  return all
    .filter((t) => t.isActive && (t.outcomeId === outcomeId || t.outcomeId === null))
    .sort((a, b) => a.position - b.position);
}

export interface TypificationInput {
  id?: string;
  outcomeId: string | null;
  label: string;
  sentiment: TypificationSentiment;
  position: number;
  isActive: boolean;
}

export function useUpsertTypification() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (input: TypificationInput) => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const row = {
        tenant_id: tenantId,
        outcome_id: input.outcomeId,
        label: input.label.trim(),
        sentiment: input.sentiment,
        position: input.position,
        is_active: input.isActive,
      };
      const q = input.id
        ? (supabase as any).from("outcome_typifications").update(row).eq("id", input.id)
        : (supabase as any).from("outcome_typifications").insert(row);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outcome-typifications"] }),
  });
}

export function useDeleteTypification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("outcome_typifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outcome-typifications"] }),
  });
}

/** Sugerencia de tipificación por IA según la conversación reciente del contacto. */
export async function suggestTypification(
  contactId: string,
  outcomeId: string,
  note?: string,
): Promise<string | null> {
  try {
    const { data, error } = await (supabase as any).functions.invoke("typification-suggest", {
      body: { contactId, outcomeId, note: (note ?? "").slice(0, 1000) },
    });
    if (error || !data?.typificationId) return null;
    return data.typificationId as string;
  } catch {
    return null;
  }
}
