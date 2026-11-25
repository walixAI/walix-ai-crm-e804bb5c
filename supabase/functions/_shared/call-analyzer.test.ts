import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateChatCompletion } from "npm:@lovable.dev/ai-gateway@0.1.13";
import { recordAiUsage } from "./ai-usage";
import { analyzeCall } from "./call-analyzer";
vi.mock("npm:@lovable.dev/ai-gateway@0.1.13", () => ({ generateChatCompletion: vi.fn(), GatewayError: class extends Error {} }));
vi.mock("./ai-usage.ts", () => ({ recordAiUsage: vi.fn() }));
function admin(overrides: Record<string, unknown> = {}) {
  return { rpc: vi.fn(async () => ({ data: { state: "claimed", id: "run" }, error: null })), from: vi.fn(() => {
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), update: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: { id: "call", tenant_id: "tenant", user_id: "advisor", transcript: "El prospecto solicita una visita de seguimiento.", direction: "outbound", ...overrides } })) };
    return q;
  }) };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateChatCompletion).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ summary: "Quiere visita", profile: [] }) } }], usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 } } as never);
});
describe("call analysis usage", () => {
  it("records automatic analysis once, attributed to the advisor, without deducting plan credits", async () => {
    expect((await analyzeCall(admin(), "call")).ok).toBe(true);
    expect(recordAiUsage).toHaveBeenCalledTimes(1);
    expect(recordAiUsage).toHaveBeenCalledWith({ tenantId: "tenant", userId: "advisor", surface: "call_analyzer", model: "openai/gpt-6-astra", charge: false, inputTokens: 123, outputTokens: 45, totalTokens: 168 });
  });
  it("attributes a requested reanalysis to the authenticated initiating user", async () => {
    await analyzeCall(admin(), "call", undefined, "initiator");
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: "initiator", charge: false }));
  });
  it("counts a successful model request even when its analysis is invalid", async () => {
    vi.mocked(generateChatCompletion).mockResolvedValue({ choices: [{ message: { content: "invalid" } }] } as never);
    expect((await analyzeCall(admin(), "call")).ok).toBe(false);
    expect(recordAiUsage).toHaveBeenCalledTimes(1);
  });
  it("reuses an unchanged prior analysis without inference", async () => {
    const svc = admin({ ai_summary: "Ya analizado" });
    expect(await analyzeCall(svc, "call")).toMatchObject({ ok: true, reused: true, summary: "Ya analizado" });
    expect(generateChatCompletion).not.toHaveBeenCalled();
  });
  it("blocks concurrent callbacks before inference", async () => {
    const svc = admin();
    svc.rpc.mockResolvedValue({ data: { state: "processing", id: "run" }, error: null });
    expect(await analyzeCall(svc, "call")).toMatchObject({ ok: false, status: 409 });
    expect(generateChatCompletion).not.toHaveBeenCalled();
  });
  it("does not automatically replay an uncertain prior attempt", async () => {
    const svc = admin();
    svc.rpc.mockResolvedValue({ data: { state: "unknown", id: "run" }, error: null });
    expect(await analyzeCall(svc, "call")).toMatchObject({ ok: false, status: 409 });
    expect(generateChatCompletion).not.toHaveBeenCalled();
  });
  it("changed transcripts are not confused with cached analyses", async () => {
    const svc = admin({ ai_summary: "Anterior" });
    await analyzeCall(svc, "call", "El prospecto ya no quiere la visita y pide otro horario.");
    expect(generateChatCompletion).toHaveBeenCalledTimes(1);
  });
  it("manual requests bypass the previous successful cache", async () => {
    const svc = admin({ ai_summary: "Anterior" });
    await analyzeCall(svc, "call", undefined, "advisor", true);
    expect(generateChatCompletion).toHaveBeenCalledTimes(1);
    expect(svc.rpc).toHaveBeenCalledWith("claim_call_analysis", expect.objectContaining({ p_manual: true }));
  });
  it("skips greeting-only audio but preserves explicit manual analysis", async () => {
    expect(await analyzeCall(admin({ transcript: "Hola. Buenos días. Hola." }), "call")).toMatchObject({ ok: true, skipped: true });
    expect(generateChatCompletion).not.toHaveBeenCalled();
    await analyzeCall(admin({ transcript: "Hola. Buenos días. Hola." }), "call", undefined, "advisor", true);
    expect(generateChatCompletion).toHaveBeenCalledTimes(1);
  });
  it("keeps real conversations even with voicemail words or short duration", async () => {
    expect(await analyzeCall(admin({ transcript: "Me mandó a buzón ayer, pero hoy sí quiero la visita." }), "call")).toMatchObject({ ok: true });
    expect(generateChatCompletion).toHaveBeenCalledTimes(1);
  });
});