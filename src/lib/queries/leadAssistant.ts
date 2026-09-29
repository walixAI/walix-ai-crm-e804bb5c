import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadBrief {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  intent: "alta" | "media" | "baja";
  motivators: string[];
  objections: string[];
  alerts: { level: "danger" | "warning" | "info"; text: string }[];
  next_step: { action: string; title: string; reason: string; urgency: "alta" | "media" | "baja"; when: string };
  messages: { tone: string; text: string }[];
  call_script: { opening: string; points: string[]; objection_handling: { objection: string; answer: string }[]; close: string };
  close_probability: { pct: number; label: "Alta" | "Media" | "Baja"; reason: string };
}

async function fetchBrief(contactId: string, force = false) {
  const { data, error } = await supabase.functions.invoke("lead-assistant", { body: { contactId, force } });
  if (error || data?.error) throw new Error(data?.error ?? "No se pudo generar la asesoría");
  return data as { brief: LeadBrief; generated_at: string; cached: boolean };
}

/** Se actualiza sola: el backend regenera solo si hay mensajes/actividades nuevas. `signal` cambia con cada novedad. */
export function useLeadAssistant(contactId: string | null | undefined, signal?: string | number | null) {
  const qc = useQueryClient();
  const key = ["lead-assistant", contactId, signal ?? null];
  const q = useQuery({
    queryKey: key,
    enabled: !!contactId,
    staleTime: 60_000,
    retry: false,
    queryFn: () => fetchBrief(contactId!),
  });
  const regenerate = async () => {
    const r = await fetchBrief(contactId!, true);
    qc.setQueryData(key, r);
  };
  return { ...q, regenerate };
}
