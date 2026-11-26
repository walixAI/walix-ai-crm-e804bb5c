import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PipelineDeal } from "@/lib/queries/pipeline";

const { insert, eq, update, from, toastError, toastSuccess, onClose } = vi.hoisted(() => ({
  insert: vi.fn().mockResolvedValue({ error: null }),
  eq: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn(() => ({ eq })),
  from: vi.fn(() => ({ insert, update })),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  onClose: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock("@/lib/queries/tenant", () => ({ useTenantId: () => ({ data: "tenant-1" }) }));
vi.mock("@/lib/queries/tenantUsers", () => ({ useTenantUsers: () => ({ data: [] }) }));
vi.mock("@/lib/queries/pipeline", () => ({
  useContactPipelineDeals: () => ({ data: [] }),
  useStages: () => ({ data: [] }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/components/pipeline/NewDealDialog", () => ({ NewDealDialog: () => null }));

import { QuickTaskDialog } from "./QuickTaskDialog";

const deal = { id: "d1", name: "Maestría en Administración", amount: 100, contactId: "c1" } as PipelineDeal;

function openDialog() {
  render(<QuickTaskDialog open deal={deal} onClose={onClose} />);
  const title = screen.getByPlaceholderText("Llamar al cliente…");
  const due = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
  return { title, due };
}

afterEach(() => {
  cleanup();
  insert.mockClear();
  insert.mockResolvedValue({ error: null });
  update.mockClear();
  eq.mockClear();
  eq.mockResolvedValue({ error: null });
  toastError.mockClear();
  toastSuccess.mockClear();
  onClose.mockClear();
});

describe("task dialog due date", () => {
  it("shows a readable error and stays usable when the typed year is unreadable", () => {
    const { title, due } = openDialog();
    fireEvent.change(title, { target: { value: "Llamar al cliente" } });
    fireEvent.change(due, { target: { value: "20255-01-01T10:00" } });
    expect(due.value).toBe("20255-01-01T10:00");
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(toastError).toHaveBeenCalledWith("La fecha de vencimiento no es válida");
    expect(insert).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Crear" });
    expect(button).not.toBeDisabled();
    expect(screen.queryByText("Guardando…")).toBeNull();
  });

  it("saves the task with the chosen due date", async () => {
    const { title, due } = openDialog();
    fireEvent.change(title, { target: { value: "Llamar al cliente" } });
    fireEvent.change(due, { target: { value: "2026-01-01T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(insert).toHaveBeenCalled());
    expect(insert.mock.calls[0][0]).toMatchObject({
      tenant_id: "tenant-1",
      deal_id: "d1",
      title: "Llamar al cliente",
      due_at: new Date("2026-01-01T10:00").toISOString(),
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("releases the button when the database rejects the task", async () => {
    insert.mockResolvedValue({ error: { message: "No se pudo guardar" } });
    const { title } = openDialog();
    fireEvent.change(title, { target: { value: "Llamar al cliente" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudo guardar"));
    const button = screen.getByRole("button", { name: "Crear" });
    expect(button).not.toBeDisabled();
    expect(screen.queryByText("Guardando…")).toBeNull();
  });
});
