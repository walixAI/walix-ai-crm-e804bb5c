import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { useClientsChannelReady, useConversationChannelReady } from "./whatsappChannels";
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}
describe("credential-free WhatsApp readiness", () => {
  beforeEach(() => rpc.mockReset());
  afterEach(cleanup);
  it("lets a rep check the tenant channel without querying secret channel rows", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useClientsChannelReady("tenant-a"), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(true));
    expect(rpc).toHaveBeenCalledWith("whatsapp_clients_channel_ready");
  });
  it("checks the exact active conversation", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useConversationChannelReady("conversation-a"), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(true));
    expect(rpc).toHaveBeenCalledWith("whatsapp_conversation_channel_ready", { p_conversation_id: "conversation-a" });
  });
  it("keeps an unauthorized or disconnected conversation blocked", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { result } = renderHook(() => useConversationChannelReady("other-conversation"), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(false));
  });
});