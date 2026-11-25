import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateChatCompletion } from "npm:@lovable.dev/ai-gateway@0.1.13";
import { recordAiUsage } from "./ai-usage";
import { analyzeCall } from "./call-analyzer";
vi.mock("npm:@lovable.dev/ai-gateway@0.1.13", () => ({ generateChatCompletion: vi.fn(), GatewayError: class extends Error {} }));
vi.mock("./ai-usage.ts", () => ({ recordAiUsage: vi.fn() }));
function admin() {
  return { from: vi.fn(() => {
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), update: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: { id: "call", tenant_id: "tenant", user_id: "advisor", transcript: "El prospecto solicita una visita de seguimiento.", direction: "outbound" } })) };
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
});