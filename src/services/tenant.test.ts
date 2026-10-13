import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { changeMemberRole } from "./tenant";

describe("changeMemberRole", () => {
  beforeEach(() => rpc.mockReset());
  it("sends tenant, target and role without accepting an actor identity", async () => {
    rpc.mockResolvedValue({ error: null });
    await changeMemberRole("tenant-a", "member-b", "sales_manager");
    expect(rpc).toHaveBeenCalledWith("change_tenant_member_role", {
      p_tenant_id: "tenant-a", p_user_id: "member-b", p_role: "sales_manager",
    });
  });
  it("rejects platform roles before making a request", async () => {
    await expect(changeMemberRole("tenant-a", "member-b", "platform_owner")).rejects.toThrow("Rol no permitido");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("surfaces server authorization failures", async () => {
    const error = { message: "Solo el propietario puede cambiar los roles de su empresa" };
    rpc.mockResolvedValue({ error });
    await expect(changeMemberRole("tenant-a", "member-b", "tenant_admin")).rejects.toEqual(error);
  });
});