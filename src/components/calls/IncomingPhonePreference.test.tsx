import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  policy: { can_receive_phone: true, phone_enabled: false, phone: "+525535637687" } as Record<string, any>,
  calls: [] as Record<string, any>[],
}));

vi.mock("@/hooks/useInboundPolicy", () => ({
  useInboundPolicy: () => ({ data: mocks.policy, isLoading: false, isError: false }),
  inboundRequest: vi.fn(async (body: Record<string, any>) => { mocks.calls.push(body); return { ok: true }; }),
}));

import { IncomingPhonePreference } from "./IncomingPhonePreference";
import { inboundRequest } from "@/hooks/useInboundPolicy";

function renderPreference() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><IncomingPhonePreference /></QueryClientProvider>);
}

beforeEach(() => {
  mocks.policy = { can_receive_phone: true, phone_enabled: false, phone: "+525535637687" };
  mocks.calls = [];
  vi.mocked(inboundRequest).mockClear();
});

afterEach(cleanup);

describe("IncomingPhonePreference", () => {
  it("keeps the phone, the warning and the switch in a single row", () => {
    const { container } = renderPreference();
    const row = container.querySelector("section > div");
    expect(row).not.toBeNull();
    const texts = Array.from(row!.children).map((child) => child.textContent ?? "");
    expect(texts.join(" ")).toContain("Teléfono de mi perfil: +525535637687");
    expect(texts.join(" ")).toContain("El desvío al celular genera minutos adicionales.");
    expect(row!.querySelectorAll("button")).toHaveLength(1);
    expect(row!.querySelector('[role="switch"], input[id="receive-incoming-phone"], #receive-incoming-phone')).not.toBeNull();
  });

  it("does not offer the profile editor", () => {
    renderPreference();
    expect(screen.queryByText(/Editar perfil/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar perfil/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Editar perfil/i })).toBeNull();
  });

  it("saves the choice when the switch is toggled", async () => {
    renderPreference();
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    await waitFor(() => expect(inboundRequest).toHaveBeenCalledWith({ action: "save_inbound_preference", phone_enabled: true }));
    await waitFor(() => expect(sw).not.toBeDisabled());
  });
});
