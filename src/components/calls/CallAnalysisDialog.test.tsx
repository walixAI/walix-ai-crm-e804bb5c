import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {}, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/components/activity/LogFollowUpDialog", () => ({ LogFollowUpDialog: () => null }));
import CallAnalysisDialog from "./CallAnalysisDialog";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("uses newly received transcription for analysis without reopening the dialog", async () => {
  const qc = new QueryClient();
  const renderCall = (transcript: string) => <QueryClientProvider client={qc}><CallAnalysisDialog call={{ id: "call1", transcript }} onClose={() => {}} /></QueryClientProvider>;
  const { rerender } = render(renderCall(""));
  const transcript = "Asesor: ¿Qué servicio necesitas? Contacto: Reparación del equipo.";
  rerender(renderCall(transcript));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Analizar con IA" })); });
  expect(invoke).toHaveBeenCalledWith("call-analyzer", { body: { callId: "call1", transcript } });
});

it("preserves advisor edits when a fresh transcription arrives", async () => {
  const qc = new QueryClient();
  const renderCall = (transcript: string) => <QueryClientProvider client={qc}><CallAnalysisDialog call={{ id: "call1", transcript }} onClose={() => {}} /></QueryClientProvider>;
  const { rerender } = render(renderCall("Transcripción original de la llamada."));
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  const transcript = "Texto corregido por el asesor para analizar esta llamada.";
  fireEvent.change(screen.getByRole("textbox"), { target: { value: transcript } });
  rerender(renderCall("Nueva transcripción recibida del proveedor."));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Analizar con IA" })); });
  expect(invoke).toHaveBeenCalledWith("call-analyzer", { body: { callId: "call1", transcript } });
});