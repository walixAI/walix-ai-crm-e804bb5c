import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listener: null as null | ((event: AuthChangeEvent, session: Session | null) => void),
  getSession: vi.fn(), available: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: mocks.getSession,
    onAuthStateChange: (listener: typeof mocks.listener) => {
      mocks.listener = listener;
      return { data: { sub: {}, subscription: { unsubscribe: vi.fn() } } };
    },
  },
  from: (table: string) => ({ select: () => ({ eq: () => {
    if (table === "profiles") return { maybeSingle: async () => ({ data: { tenant_id: "tenant-1" } }) };
    return Promise.resolve({ data: table === "user_roles" ? [{ role: "sales_rep", tenant_id: "tenant-1" }] : [] });
  } }) }),
} }));
vi.mock("@/lib/agentStatus", () => ({ markAgentAvailableOnLogin: mocks.available }));
vi.mock("@/store/copilot", () => ({ useCopilot: { getState: () => ({ resetSession: vi.fn() }) } }));
import { useInitAuth } from "./useAuth";
import { useAuthStore } from "@/store/auth";

const session = { user: { id: "user-1" } } as Session;
async function emit(event: AuthChangeEvent, value: Session | null) {
  await act(async () => { mocks.listener?.(event, value); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}
async function boot(value: Session | null) {
  mocks.getSession.mockResolvedValue({ data: { session: value } });
  renderHook(() => useInitAuth());
  await waitFor(() => expect(useAuthStore.getState().contextLoading).toBe(false));
}
describe("advisor availability during authentication", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, user: null, roles: [], activeTenantId: null, loading: true, contextLoading: true });
    mocks.available.mockReset().mockResolvedValue(undefined);
    mocks.listener = null;
    sessionStorage.clear();
  });
  afterEach(cleanup);
  it.each(["new tab", "page reload", "reopened browser"])("preserves Comida when restoring a session in a %s", async () => {
    await boot(session);
    await emit("SIGNED_IN", session);
    expect(mocks.available).not.toHaveBeenCalled();
    expect(useAuthStore.getState().activeTenantId).toBe("tenant-1");
  });
  it("activates Disponible on a real login", async () => {
    await boot(null);
    await emit("SIGNED_IN", session);
    expect(mocks.available).toHaveBeenCalledExactlyOnceWith("user-1", "tenant-1");
  });
  it("does not cancel a pause on focus or token refresh after login", async () => {
    await boot(null);
    await emit("SIGNED_IN", session);
    mocks.available.mockClear();
    await emit("SIGNED_IN", session);
    await emit("TOKEN_REFRESHED", session);
    expect(mocks.available).not.toHaveBeenCalled();
  });
  it("activates Disponible after sign-out and login again in the same tab", async () => {
    await boot(null);
    await emit("SIGNED_IN", session);
    await emit("SIGNED_OUT", null);
    await emit("SIGNED_IN", session);
    expect(mocks.available).toHaveBeenCalledTimes(2);
  });
  it("does not mistake an initial SIGNED_IN emission for a login", async () => {
    mocks.getSession.mockResolvedValue({ data: { session } });
    renderHook(() => useInitAuth());
    await act(async () => { mocks.listener?.("SIGNED_IN", session); });
    await waitFor(() => expect(useAuthStore.getState().contextLoading).toBe(false));
    await emit("SIGNED_IN", session);
    expect(mocks.available).not.toHaveBeenCalled();
  });
});