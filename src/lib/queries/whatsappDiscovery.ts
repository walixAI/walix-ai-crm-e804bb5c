import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChannelKind } from "./whatsappChannels";

export interface DiscoveredPhone {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  name_status?: string;
}

export interface DiscoveredWaba {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  shared?: boolean;
  phones: DiscoveredPhone[];
}

export interface DiscoveredBusiness {
  id: string;
  name: string;
  wabas: DiscoveredWaba[];
}

export interface DiscoveryResult {
  ok: true;
  businesses: DiscoveredBusiness[];
  summary: { businesses: number; wabas: number; phones: number };
  token_type?: string;
  scopes?: string[];
}

export interface ConnectStepInfo {
  ok: boolean;
  detail?: string;
}

export interface ConnectResult {
  ok: true;
  channel_id: string;
  phone_number: string | null;
  verified_name: string | null;
  test_message_sent: boolean;
  steps: Record<string, ConnectStepInfo>;
}

function unwrap<T>(data: unknown): T {
  const obj = (data ?? {}) as Record<string, unknown>;
  if (obj?.error) {
    const msg = (obj.details as string) ?? (obj.error as string) ?? "Error desconocido";
    const err = new Error(msg) as Error & { code?: string; payload?: unknown };
    err.code = String(obj.error);
    err.payload = obj;
    throw err;
  }
  return data as T;
}

export function useDiscoverWaba() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-discover-waba", {
        body: { token },
      });
      if (error) throw new Error(error.message);
      return unwrap<DiscoveryResult>(data);
    },
  });
}

export function useConnectDiscovered(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      token: string;
      waba_id: string;
      phone_number_id: string;
      kind: ChannelKind;
    }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect-discovered", {
        body: input,
      });
      if (error) throw new Error(error.message);
      return unwrap<ConnectResult>(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] }),
  });
}