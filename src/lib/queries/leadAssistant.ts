import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface LeadBrief {
  profile?: { key: string; label: string; value: string }[];
  profile_completeness?: number;
  deal_probabilities?: { id: string; name: string; pct: number; reason: string }[];
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
  const key = ["lead-assistant", contactId];
  useEffect(() => {
    if (contactId) void qc.invalidateQueries({ queryKey: ["lead-assistant", contactId] });
  }, [contactId, signal, qc]);
  const q = useQuery({
    queryKey: key,
    enabled: !!contactId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      if (!contactId) throw new Error("Contacto no disponible");
      const result = await fetchBrief(contactId);
      for (const prefix of ["pipeline-deals", "pipeline-deal", "contact-deals", "contact-pipeline-deals", "contact"]) {
        void qc.invalidateQueries({ queryKey: [prefix] });
      }
      return result;
    },
  });
  const regenerate = async () => {
    if (!contactId) return;
    const r = await fetchBrief(contactId, true);
    qc.setQueryData(key, r);
    for (const prefix of ["pipeline-deals", "pipeline-deal", "contact-deals", "contact-pipeline-deals", "contact"]) {
      void qc.invalidateQueries({ queryKey: [prefix] });
    }
  };
  return { ...q, regenerate };
}
