import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), devices: [] as any[], mic: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@twilio/voice-sdk", () => ({ Device: class {
  static State = { Registered: "registered" };
  state = "registered";
  calls: any[] = [];
  handlers = new Map<string, (...args: any[]) => void>();
  register = vi.fn(async () => {});
  destroy = vi.fn();
  updateToken = vi.fn();
  on(event: string, callback: (...args: any[]) => void) { this.handlers.set(event, callback); }
  constructor() { mocks.devices.push(this); }
} }));
import { useIncomingBrowserCall } from "./useIncomingBrowserCall";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks(); mocks.devices.length = 0;
  mocks.invoke.mockResolvedValue({ data: { ok: true, tokens: [{ channel_id: "canal", token: "token-de-prueba" }] }, error: null });
  mocks.mic.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.mic } });
});

function incoming() {
  const handlers = new Map<string, () => void>();
  return {
    customParameters: new Map([["WalixCallId", "11111111-1111-4111-8111-111111111111"]]),
    on: (event: string, cb: () => void) => handlers.set(event, cb),
    accept: vi.fn(() => handlers.get("accept")?.()),
    reject: vi.fn(() => handlers.get("reject")?.()),
    disconnect: vi.fn(() => handlers.get("disconnect")?.()),
    mute: vi.fn(),
  };
}

describe("contestar dentro de Walix", () => {
  it("registra recepción sin celular y permite contestar, silenciar y colgar", async () => {
    const { result } = renderHook(() => useIncomingBrowserCall("empresa", "asesor"));
    await waitFor(() => expect(mocks.devices[0]?.register).toHaveBeenCalled());
    expect(mocks.mic).not.toHaveBeenCalled();
    const call = incoming();
    act(() => mocks.devices[0].handlers.get("incoming")(call));
    expect(result.current.state).toBe("ringing");
    await act(() => result.current.accept());
    expect(mocks.mic).toHaveBeenCalledWith({ audio: true });
    expect(call.accept).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("connected");
    act(() => result.current.toggleMute());
    expect(call.mute).toHaveBeenCalledWith(true);
    await act(() => result.current.end());
    expect(mocks.invoke).toHaveBeenCalledWith("telephony-api", { body: { action: "end", call_id: "11111111-1111-4111-8111-111111111111" } });
    expect(call.disconnect).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
  });
  it("no contesta si se rechaza el permiso del micrófono", async () => {
    mocks.mic.mockRejectedValue(new Error("permiso"));
    const { result } = renderHook(() => useIncomingBrowserCall("empresa", "asesor"));
    await waitFor(() => expect(mocks.devices[0]?.register).toHaveBeenCalled());
    const call = incoming();
    act(() => mocks.devices[0].handlers.get("incoming")(call));
    await act(() => result.current.accept());
    expect(call.accept).not.toHaveBeenCalled();
    expect(result.current.state).toBe("ringing");
  });
  it("does not mark a remote disconnect or rejection as advisor hangup", async () => {
    const { result } = renderHook(() => useIncomingBrowserCall("empresa", "asesor"));
    await waitFor(() => expect(mocks.devices[0]?.register).toHaveBeenCalled());
    const call = incoming();
    act(() => mocks.devices[0].handlers.get("incoming")(call));
    await act(() => result.current.end());
    expect(call.reject).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalledWith("telephony-api", expect.objectContaining({ body: expect.objectContaining({ action: "end" }) }));
    const connected = incoming();
    act(() => mocks.devices[0].handlers.get("incoming")(connected));
    await act(() => result.current.accept());
    act(() => connected.disconnect());
    expect(result.current.state).toBe("idle");
    expect(mocks.invoke).not.toHaveBeenCalledWith("telephony-api", expect.objectContaining({ body: expect.objectContaining({ action: "end" }) }));
  });
  it("keeps a connected call available for retry when the hangup request fails", async () => {
    const { result } = renderHook(() => useIncomingBrowserCall("empresa", "asesor"));
    await waitFor(() => expect(mocks.devices[0]?.register).toHaveBeenCalled());
    const call = incoming();
    act(() => mocks.devices[0].handlers.get("incoming")(call));
    await act(() => result.current.accept());
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error("network") });
    await act(() => result.current.end());
    expect(call.disconnect).not.toHaveBeenCalled();
    expect(result.current.state).toBe("connected");
  });
  it("desconecta la llamada y elimina la recepción al cambiar de empresa", async () => {
    const { result, rerender } = renderHook(({ tenant }) => useIncomingBrowserCall(tenant, "asesor"), { initialProps: { tenant: "empresa-a" } });
    await waitFor(() => expect(mocks.devices[0]?.register).toHaveBeenCalled());
    const device = mocks.devices[0];
    const call = incoming();
    act(() => device.handlers.get("incoming")(call));
    await act(async () => { rerender({ tenant: "empresa-b" }); });
    expect(device.destroy).toHaveBeenCalledOnce();
    expect(call.disconnect).toHaveBeenCalledOnce();
    expect(result.current.call).toBeNull();
  });
});