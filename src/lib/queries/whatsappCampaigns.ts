import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "./tenant";

export interface CampaignConditions {
  source_kinds?: string[];
  ga_channels?: string[];
  utm_sources?: string[];
  utm_campaigns?: string[];
  cities?: string[];
  regions?: string[];
  products?: string[];
  tags?: string[];
  owner_ids?: string[];
  stage_ids?: string[];
  lifecycle?: string[];
  no_reply_days?: number | null;
  created_within_days?: number | null;
}

export interface CampaignSchedule {
  days?: number[];
  start?: string;
  end?: string;
  tz?: string;
}

export interface WaCampaign {
  id: string;
  tenant_id: string;
  name: string;
  objective: string | null;
  rule_mode: "filters" | "prompt";
  rule_prompt: string | null;
  rule_unresolved: string[] | null;
  conditions: CampaignConditions;
  priority: number;
  schedule: CampaignSchedule | null;
  stop_on_reply: boolean;
  stop_on_stage_change: boolean;
  stop_on_closed: boolean;
  is_active: boolean;
  created_at: string;
}

export interface WaCampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  wait_hours: number;
  kind: "template" | "text";
  template_id: string | null;
  template_variables: string[] | null;
  body_text: string | null;
}

export interface WaTemplate {
  id: string;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  body_text: string | null;
  variables: string[] | null;
}

export const OBJECTIVES = [
  { value: "calificar", label: "Calificar el lead" },
  { value: "agendar", label: "Agendar una cita" },
  { value: "cotizar", label: "Enviar cotización" },
  { value: "reactivar", label: "Reactivar contacto" },
  { value: "cobrar", label: "Recordatorio de pago" },
  { value: "encuesta", label: "Encuesta / retroalimentación" },
];

export function useCampaigns() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["wa-campaigns", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_campaigns")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WaCampaign[];
    },
  });
}

export function useCampaignSteps(campaignId?: string) {
  return useQuery({
    queryKey: ["wa-campaign-steps", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_campaign_steps")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("step_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WaCampaignStep[];
    },
  });
}

export function useWaTemplates() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["wa-templates", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_templates")
        .select("id, name, language, category, status, body_text, variables")
        .eq("tenant_id", tenantId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WaTemplate[];
    },
  });
}

export function useCampaignMetrics(campaignId?: string) {
  return useQuery({
    queryKey: ["wa-campaign-metrics", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const [{ data: enrolls }, { data: sends }] = await Promise.all([
        supabase.from("wa_enrollments").select("status").eq("campaign_id", campaignId!),
        supabase.from("wa_step_sends").select("status").eq("campaign_id", campaignId!),
      ]);
      const count = (rows: { status: string }[] | null, s: string) => (rows ?? []).filter((r) => r.status === s).length;
      return {
        activos: count(enrolls as any, "active"),
        completados: count(enrolls as any, "completed"),
        detenidos: count(enrolls as any, "stopped"),
        enviados: count(sends as any, "sent"),
        fallidos: count(sends as any, "failed"),
        pendientes_plantilla: count(sends as any, "pending_template"),
      };
    },
  });
}

export function useCampaignLog(campaignId?: string) {
  return useQuery({
    queryKey: ["wa-campaign-log", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_step_sends")
        .select("id, step_order, status, error_message, sent_at, created_at, contacts(name, phone)")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveCampaign() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (payload: Partial<WaCampaign> & { steps?: Partial<WaCampaignStep>[] }) => {
      const { steps, id, ...campaign } = payload;
      let campaignId = id;
      if (campaignId) {
        const { error } = await supabase.from("wa_campaigns").update(campaign as any).eq("id", campaignId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("wa_campaigns")
          .insert({ ...(campaign as any), tenant_id: tenantId })
          .select("id")
          .single();
        if (error) throw error;
        campaignId = data.id;
      }
      if (steps) {
        await supabase.from("wa_campaign_steps").delete().eq("campaign_id", campaignId!);
        if (steps.length) {
          const rows = steps.map((s, i) => ({
            tenant_id: tenantId,
            campaign_id: campaignId,
            step_order: i,
            wait_hours: s.wait_hours ?? (i === 0 ? 0 : 24),
            kind: s.kind ?? "text",
            template_id: s.template_id ?? null,
            template_variables: s.template_variables ?? [],
            body_text: s.body_text ?? null,
          }));
          const { error } = await supabase.from("wa_campaign_steps").insert(rows as any);
          if (error) throw error;
        }
      }
      return campaignId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-campaigns"] });
      qc.invalidateQueries({ queryKey: ["wa-campaign-steps"] });
    },
  });
}

export function useToggleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("wa_campaigns").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wa_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-campaigns"] }),
  });
}

export function useInterpretRulePrompt() {
  return useMutation({
    mutationFn: async (prompt: string) => {
      const { data, error } = await supabase.functions.invoke("wa-campaign-rule-ai", { body: { prompt } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        conditions: CampaignConditions;
        objective: string;
        unresolved: string[];
        summary: string;
        preview: { total: number; sample: { id: string; name: string; phone: string }[] };
      };
    },
  });
}

export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("wa-templates-sync", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { synced: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-templates"] }),
  });
}

export function useSegmentSend() {
  return useMutation({
    mutationFn: async (body: {
      conditions?: CampaignConditions;
      contact_ids?: string[];
      template_id?: string | null;
      text?: string;
      preview?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("wa-segment-send", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { total: number; sample?: any[]; sent?: number; failed?: number };
    },
  });
}
