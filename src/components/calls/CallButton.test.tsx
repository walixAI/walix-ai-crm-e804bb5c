import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), error: vi.fn(), success: vi.fn(), followUp: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("@/components/activity/LogFollowUpDialog", () => ({ LogFollowUpDialog: (props: unknown) => { mocks.followUp(props); return null; } }));
import { CallButton } from "./CallButton";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("CallButton failure handling", () => {
  it.each([
    [401, "Sesión inválida"],
    [400, "No hay canal de llamadas configurado. Pide a un administrador que lo active en Configuración → Llamadas."],
    [404, "Contacto no encontrado"],
    [400, "Número destino inválido"],
    [500, "Error interno"],
  ])("preserves the server reason for HTTP %s without closing or recording a result", async (status, reason) => {
    mocks.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ error: reason }), { status })) });
    const originalUrl = window.location.href;
    render(<CallButton contactId="c1" phone="+525555555555" />);
    fireEvent.click(screen.getByRole("button", { name: "Llamar" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(reason));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(window.location.href).toBe(originalUrl);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.followUp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar seguimiento" }));
    expect(mocks.followUp).toHaveBeenCalledWith(expect.objectContaining({ contactId: "c1", open: true, initialDescription: expect.stringContaining(reason) }));
  });

  it("handles a rejected request and permits retry", async () => {
    mocks.invoke.mockRejectedValueOnce(new Error("network"));
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true, call: { id: "call1" }, provider: "twilio" }, error: null });
    render(<CallButton phone="+525555555555" />);
    fireEvent.click(screen.getByRole("button", { name: "Llamar" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("button", { name: "Contestó" });
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });

  it("keeps the call ID and notes when saving the result fails", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true, call: { id: "call1" }, provider: "twilio" }, error: null });
    mocks.invoke.mockResolvedValueOnce({ data: { ok: false, error: "No se guardó" }, error: null });
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    render(<CallButton contactId="c1" phone="+525555555555" />);
    fireEvent.click(screen.getByRole("button", { name: "Llamar" }));
    await screen.findByRole("button", { name: "Contestó" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Solicitó información" } });
    fireEvent.click(screen.getByRole("button", { name: "Contestó" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("No se guardó"));
    expect(mocks.success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Contestó" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).toHaveBeenLastCalledWith("telephony-api", { body: expect.objectContaining({ action: "end", call_id: "call1", notes: "Solicitó información" }) });
  });
});