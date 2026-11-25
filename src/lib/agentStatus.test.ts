import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from, maybeSingle } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const from = vi.fn(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle }) }) }) }) }),
  }));
  return { rpc: vi.fn(), from, maybeSingle };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));

import { markAgentAvailableOnLogin } from "./agentStatus";

describe("markAgentAvailableOnLogin", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockClear();
    maybeSingle.mockReset();
    sessionStorage.clear();
  });

  it("sets the advisor to Disponible with cause login on first login", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "reason-available" } });
    rpc.mockResolvedValue({ error: null });
    await markAgentAvailableOnLogin("user-1", "tenant-1");
    expect(rpc).toHaveBeenCalledWith("set_agent_status", {
      _reason_id: "reason-available",
      _user_id: null,
      _cause: "login",
    });
  });

  it("sets Disponible again after a second genuine login in the same tab", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "reason-available" } });
    rpc.mockResolvedValue({ error: null });
    await markAgentAvailableOnLogin("user-1", "tenant-1");
    await markAgentAvailableOnLogin("user-1", "tenant-1");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("does nothing without an active tenant", async () => {
    await markAgentAvailableOnLogin("user-1", null);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does nothing when the tenant has no available reason", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    await markAgentAvailableOnLogin("user-1", "tenant-1");
    expect(rpc).not.toHaveBeenCalled();
  });
});
