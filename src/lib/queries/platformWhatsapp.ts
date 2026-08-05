import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WhatsappChannel, PermLevel } from "./whatsappChannels";

function genVerifyToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PLATFORM_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

/** Canal global de Walix (uno solo para toda la plataforma). */
export function usePlatformChannel() {
  return useQuery({
    queryKey: ["platform-wa-channel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_channels")
        .select("*")
        .eq("is_platform", true)
        .maybeSingle();
      if (error) throw error;
      return (data as WhatsappChannel | null) ?? null;
    },
  });
}

export function useSavePlatformChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      display_name: string;
      phone_number: string;
      phone_number_id: string;
      business_account_id: string;
      access_token?: string;
    }) => {
      const hasToken = !!input.access_token?.trim();
      if (input.id) {
        const { error } = await supabase.from("whatsapp_channels").update({
          display_name: input.display_name,
          phone_number: input.phone_number,
          phone_number_id: input.phone_number_id,
          business_account_id: input.business_account_id,
          last_error: null,
          ...(hasToken ? { access_token: input.access_token!.trim() } : {}),
        }).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      if (!hasToken) throw new Error("El token de acceso es obligatorio");
      const { data, error } = await supabase.from("whatsapp_channels").insert({
        tenant_id: null,
        is_platform: true,
        kind: "team",
        provider: "meta_cloud",
        label: "Walix Bot (global)",
        display_name: input.display_name,
        phone_number: input.phone_number,
        phone_number_id: input.phone_number_id,
        business_account_id: input.business_account_id,
        access_token: input.access_token!.trim(),
        verify_token: genVerifyToken(),
        status: "pending",
        is_default: false,
        position: 0,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-wa-channel"] }),
  });
}

export function useTestPlatformNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (to: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-platform-test", { body: { to } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { ok: boolean; wamid: string | null };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-wa-channel"] }),
  });
}

export interface PlatformAccessRow {
  id: string;
  tenant_id: string;
  display_name: string | null;
  phone_e164: string;
  enabled: boolean;
  permission_level: PermLevel;
  tenant_name: string;
}

/** Todos los teléfonos autorizados de todas las empresas. */
export function useAllUserAccess() {
  return useQuery({
    queryKey: ["platform-wa-access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_user_access")
        .select("id, tenant_id, display_name, phone_e164, enabled, permission_level")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
      let names = new Map<string, string>();
      if (tenantIds.length) {
        const { data: tenants } = await supabase
          .from("tenants").select("id, name, brand_name").in("id", tenantIds);
        names = new Map((tenants ?? []).map((t: any) => [t.id, t.brand_name || t.name]));
      }
      return rows.map((r) => ({ ...r, tenant_name: names.get(r.tenant_id) ?? "—" })) as PlatformAccessRow[];
    },
  });
}

export function useToggleAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("whatsapp_user_access").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-wa-access"] }),
  });
}
export interface PlatformBotPublic {
  id: string;
  phone_number: string | null;
  display_name: string | null;
  label: string | null;
  status: string | null;
}

/** Datos públicos (sin credenciales) del número global de Walix, visibles para cualquier tenant. */
export function usePlatformBotPublic() {
  return useQuery({
    queryKey: ["platform-wa-bot-public"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_whatsapp_bot" as any)
        .select("id, phone_number, display_name, label, status")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PlatformBotPublic | null;
    },
  });
}
