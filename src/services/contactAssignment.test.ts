import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { reassignContact } from "./contactAssignment";
describe("reassignContact", () => {
  beforeEach(() => rpc.mockReset());
  it("uses atomic reassignment without accepting caller-supplied tenant or actor", async () => {
    rpc.mockResolvedValue({ error: null });
    await reassignContact("contact-a", "advisor-b");
    expect(rpc).toHaveBeenCalledWith("reassign_contact_atomic", { p_contact_id: "contact-a", p_new_owner_id: "advisor-b" });
  });
  it("surfaces server ownership failures", async () => {
    const error = { message: "Solo puedes reasignar tus contactos" };
    rpc.mockResolvedValue({ error });
    await expect(reassignContact("other-contact", "advisor-b")).rejects.toEqual(error);
  });
});