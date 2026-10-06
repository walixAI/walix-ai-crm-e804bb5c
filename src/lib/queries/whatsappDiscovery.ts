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

// Non-2xx responses hide the server's JSON inside error.context; read it so the real reason is shown.
async function readFnError(error: unknown): Promise<unknown> {
  const ctx = (error as { context?: Response })?.context;
  try {
    if (ctx && typeof ctx.json === "function") return await ctx.clone().json();
  } catch { /* ignore */ }
  return { error: "request_failed", details: (error as Error)?.message ?? "Error desconocido" };
}

export function useDiscoverWaba() {
  return useMutation({
    mutationFn: async (input: string | { token: string; waba_id?: string }) => {
      const body = typeof input === "string" ? { token: input } : input;
      const { data, error } = await supabase.functions.invoke("whatsapp-discover-waba", {
        body,
      });
      if (error) { unwrap(await readFnError(error)); throw new Error(error.message); }
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
      if (error) { unwrap(await readFnError(error)); throw new Error(error.message); }
      return unwrap<ConnectResult>(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] }),
  });
}