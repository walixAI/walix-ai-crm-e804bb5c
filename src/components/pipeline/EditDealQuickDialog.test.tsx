import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PipelineDeal } from "@/lib/queries/pipeline";
const { save } = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/queries/pipeline", () => ({ useUpdateDeal: () => ({ mutateAsync: save, isPending: false }) }));
vi.mock("@/lib/queries/dealFieldHistory", () => ({ useLogDealFieldChange: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }) }));
import { EditDealQuickDialog } from "./EditDealQuickDialog";
describe("opportunity modal", () => {
  afterEach(() => { cleanup(); save.mockClear(); });
  const deal = { id: "d1", name: "Programa anterior", amount: 100, contactId: "c1" } as PipelineDeal;
  it("saves name and amount together from the opportunity modal", async () => {
    const close = vi.fn();
    render(<EditDealQuickDialog deal={deal} onClose={close} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Maestría en Administración" } });
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ dealId: "d1", patch: { name: "Maestría en Administración", amount: 1500 } }));
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
  it("does not replace an invalid amount with zero", () => {
    render(<EditDealQuickDialog deal={deal} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(save).not.toHaveBeenCalled();
  });
});