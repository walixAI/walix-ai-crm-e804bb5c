import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn(), data: { can_manage: true, policy: { allow_all: true, allowed_user_ids: [] }, members: [{ id: "advisor-1", full_name: "Asesor uno", phone: null }, { id: "advisor-2", full_name: "Asesor dos", phone: null }] } }));
vi.mock("@/lib/queries/phoneCallPermissions", () => ({
  phonePermissionRequest: mocks.request,
  usePhoneCallPermissions: () => ({ data: mocks.data }),
}));
import { PhoneCallPermissions } from "./PhoneCallPermissions";

afterEach(cleanup);
beforeEach(() => { mocks.data.can_manage = true; mocks.request.mockReset(); mocks.request.mockResolvedValue({ ok: true }); });
function renderPermissions() {
  render(<QueryClientProvider client={new QueryClient()}><PhoneCallPermissions /></QueryClientProvider>);
}
describe("owner phone authorization", () => {
  it("saves only the advisors selected by the owner", async () => {
    renderPermissions();
    fireEvent.click(screen.getByRole("radio", { name: /Solo algunos usuarios/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Autorizar a Asesor uno" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith({ action: "save_phone_permissions", allow_all: false, allowed_user_ids: ["advisor-1"] }));
  });
  it("does not expose editing to a non-owner", () => {
    mocks.data.can_manage = false;
    renderPermissions();
    expect(screen.queryByRole("button", { name: "Guardar permisos" })).not.toBeInTheDocument();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});