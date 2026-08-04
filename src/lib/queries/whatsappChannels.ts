import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChannelKind = "clients" | "team";
export type ChannelStatus = "pending" | "connected" | "error" | "disabled";
export type PermLevel = "read" | "write_light" | "write_strong";

export interface WhatsappChannel {
  id: string;
  tenant_id: string;
  kind: ChannelKind;
  provider: string;
  display_name: string | null;
  phone_number: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  verify_token: string;
  status: ChannelStatus;
  last_error: string | null;
  connected_at: string | null;
  access_token: string | null;
  last_inbound_at: string | null;
  last_inbound_from: string | null;
  last_webhook_at: string | null;
  is_default: boolean;
  label: string | null;
  position: number;
  is_platform: boolean;
}

export interface WhatsappUserAccess {
  id: string;
  tenant_id: string;
  user_id: string | null;
  display_name: string | null;
  phone_e164: string;
  enabled: boolean;
  permission_level: PermLevel;
}

function genVerifyToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useWhatsappChannels(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["wa-channels", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_channels")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("kind")
        .order("is_default", { ascending: false })
        .order("position", { ascending: true });
      if (error) throw error;
      return data as WhatsappChannel[];
    },
  });
}

/** Marca un número como predeterminado para su tipo de canal. */
export function useSetDefaultChannel(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: ChannelKind }) => {
      const { error: e1 } = await supabase.from("whatsapp_channels")
        .update({ is_default: false }).eq("tenant_id", tenantId).eq("kind", kind).neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("whatsapp_channels")
        .update({ is_default: true }).eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] }),
  });
}

export function useUpsertChannel(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: ChannelKind;
      display_name?: string;
      phone_number: string;
      phone_number_id: string;
      business_account_id: string;
      access_token?: string;
      /** Si se indica, actualiza ese número; si es "new", crea uno adicional. */
      channelId?: string | "new";
      label?: string;
    }) => {
      // Find existing (por id explícito, o el predeterminado del tipo)
      let existing: { id: string; verify_token: string } | null = null;
      if (input.channelId && input.channelId !== "new") {
        const { data } = await supabase.from("whatsapp_channels").select("id, verify_token")
          .eq("id", input.channelId).maybeSingle();
        existing = data as any;
      } else if (input.channelId !== "new") {
        const { data } = await supabase.from("whatsapp_channels").select("id, verify_token")
          .eq("tenant_id", tenantId).eq("kind", input.kind)
          .order("is_default", { ascending: false }).limit(1).maybeSingle();
        existing = data as any;
      }
      const verify_token = existing?.verify_token ?? genVerifyToken();
      if (existing) {
        const hasNewToken = !!(input.access_token && input.access_token.trim().length > 0);
        const update = {
          display_name: input.display_name ?? null,
          phone_number: input.phone_number,
          phone_number_id: input.phone_number_id,
          business_account_id: input.business_account_id,
          status: "pending" as const,
          last_error: null,
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(hasNewToken ? { access_token: input.access_token! } : {}),
        };
        const { error } = await supabase.from("whatsapp_channels").update(update).eq("id", existing.id);
        if (error) throw error;
        return { id: existing.id, verify_token };
      } else {
        if (!input.access_token) throw new Error("access_token requerido");
        const { count } = await supabase.from("whatsapp_channels")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("kind", input.kind);
        const { data, error } = await supabase.from("whatsapp_channels").insert({
          tenant_id: tenantId,
          kind: input.kind,
          provider: "meta_cloud",
          display_name: input.display_name ?? null,
          phone_number: input.phone_number,
          phone_number_id: input.phone_number_id,
          business_account_id: input.business_account_id,
          access_token: input.access_token,
          verify_token,
          status: "pending",
          label: input.label ?? null,
          position: count ?? 0,
          is_default: (count ?? 0) === 0,
        }).select("id, verify_token").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] }),
  });
}

export function useTestChannel(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-verify", {
        body: { channel_id: channelId },
      });
      if (error) throw error;
      return data as { ok: boolean; status: string; last_error?: string; meta_info?: { display_phone_number?: string; verified_name?: string } };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] }),
  });
}

export function useDisconnectChannel(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await supabase.from("whatsapp_channels")
        .update({ status: "disabled" }).eq("id", channelId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] }),
  });
}

export function useWhatsappUserAccess(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["wa-user-access", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_user_access")
        .select("*").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data as WhatsappUserAccess[];
    },
  });
}

export function useUpsertUserAccess(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      display_name: string;
      phone_e164: string;
      enabled: boolean;
      permission_level: PermLevel;
      user_id?: string | null;
    }) => {
      if (input.id) {
        const { error } = await supabase.from("whatsapp_user_access").update({
          display_name: input.display_name,
          phone_e164: input.phone_e164,
          enabled: input.enabled,
          permission_level: input.permission_level,
        }).eq("id", input.id);
        if (error) throw error;
        return { id: input.id, created: false };
      } else {
        const { data, error } = await supabase.from("whatsapp_user_access").insert({
          tenant_id: tenantId,
          display_name: input.display_name,
          phone_e164: input.phone_e164,
          enabled: input.enabled,
          permission_level: input.permission_level,
          user_id: input.user_id ?? null,
        }).select("id").single();
        if (error) throw error;
        return { id: data.id as string, created: true };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-user-access", tenantId] }),
  });
}

export function useDeleteUserAccess(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_user_access").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-user-access", tenantId] }),
  });
}