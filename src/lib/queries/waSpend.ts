import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "./tenant";

export interface TemplatePolicy {
  allowed: boolean;
  window_open: boolean;
  reason?: "monthly_cap" | "lead_max" | "lead_gap" | "user_daily" | null;
  message?: string | null;
  next_at?: string | null;
  attempt?: number;
  max?: number;
  is_manager?: boolean;
  bypass?: boolean;
  monthly_used?: number;
  monthly_cap?: number | null;
}

export interface WaSpendPolicy {
  per_lead_gap_hours: number;
  per_lead_max: number;
  per_user_daily: number;
  monthly_cap: number | null;
  include_bot: boolean;
}

export const DEFAULT_SPEND_POLICY: WaSpendPolicy = {
  per_lead_gap_hours: 24, per_lead_max: 3, per_user_daily: 30, monthly_cap: null, include_bot: true,
};

export function useTemplatePolicy(tenantId: string | null | undefined, contactId: string | null | undefined, signal?: unknown) {
  return useQuery({
    queryKey: ["wa-template-policy", tenantId, contactId, signal],
    enabled: !!tenantId && !!contactId,
    queryFn: async (): Promise<TemplatePolicy> => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("wa_template_policy_check" as any, {
        _tenant_id: tenantId, _contact_id: contactId, _user_id: u.user?.id ?? null, _bot: false,
      });
      if (error) throw error;
      return data as TemplatePolicy;
    },
  });
}

export function useGrantExtraAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.rpc("wa_grant_extra_attempt" as any, { _contact_id: contactId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-template-policy"] }),
  });
}

export function useRequestExtraAttempt() {
  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase.rpc("wa_request_extra_attempt" as any, { _contact_id: contactId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

export function useSpendPolicy() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["wa-spend-policy", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<WaSpendPolicy> => {
      const { data, error } = await supabase.from("tenants").select("wa_spend_policy").eq("id", tenantId!).maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_SPEND_POLICY, ...((data as any)?.wa_spend_policy ?? {}) };
    },
  });
}

export function useSaveSpendPolicy() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (p: WaSpendPolicy) => {
      const { error } = await supabase.from("tenants").update({ wa_spend_policy: p as any }).eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-spend-policy"] }),
  });
}

export interface SpendRow { userId: string | null; name: string; sent: number; replied: number; }

/** Plantillas pagadas de los últimos N días, por asesor, y cuántas consiguieron respuesta. */
export function useWaSpendReport(days = 30) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["wa-spend-report", tenantId, days],
    enabled: !!tenantId,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: sent, error } = await supabase
        .from("messages")
        .select("id, conversation_id, created_at, metadata")
        .eq("tenant_id", tenantId!)
        .eq("direction", "outbound")
        .eq("metadata->>kind", "template")
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;
      const convIds = [...new Set((sent ?? []).map((m) => m.conversation_id))];
      const inbound: Record<string, string[]> = {};
      for (let i = 0; i < convIds.length; i += 200) {
        const { data } = await supabase
          .from("messages").select("conversation_id, created_at")
          .in("conversation_id", convIds.slice(i, i + 200)).eq("direction", "inbound").gte("created_at", since);
        for (const r of data ?? []) (inbound[r.conversation_id] ??= []).push(r.created_at);
      }
      const byUser = new Map<string, SpendRow>();
      for (const m of sent ?? []) {
        const md = (m.metadata ?? {}) as any;
        const key = md.bot ? "bot" : md.sent_by_user_id ?? "none";
        const row = byUser.get(key) ?? { userId: md.bot ? null : md.sent_by_user_id ?? null, name: md.bot ? "Bot de seguimiento" : "", sent: 0, replied: 0 };
        row.sent++;
        const t = new Date(m.created_at).getTime();
        if ((inbound[m.conversation_id] ?? []).some((x) => { const d = new Date(x).getTime() - t; return d > 0 && d < 7 * 86400_000; })) row.replied++;
        byUser.set(key, row);
      }
      const ids = [...byUser.values()].map((r) => r.userId).filter(Boolean) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        for (const r of byUser.values()) {
          const p = profs?.find((x) => x.id === r.userId);
          if (p) r.name = p.full_name || p.email || "Asesor";
          else if (!r.name) r.name = "Asesor";
        }
      }
      return [...byUser.values()].sort((a, b) => b.sent - a.sent);
    },
  });
}
