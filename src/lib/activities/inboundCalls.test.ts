import { describe, expect, it } from "vitest";
import { isMissedInbound } from "./inboundCalls";

describe("entrantes no atendidas", () => {
  it.each(["no_answer", "busy", "failed", "voicemail", "completed"])("reporta %s sin respuesta de asesor", (status) => {
    expect(isMissedInbound({ direction: "inbound", status, answered_at: null })).toBe(true);
  });
  it("no cuenta una entrante contestada como perdida", () => {
    expect(isMissedInbound({ direction: "inbound", status: "completed", answered_at: "2026-11-20T23:00:00Z" })).toBe(false);
  });
  it("no incluye intentos salientes ni entrantes aún sonando", () => {
    expect(isMissedInbound({ direction: "outbound", status: "no_answer" })).toBe(false);
    expect(isMissedInbound({ direction: "inbound", status: "ringing" })).toBe(false);
  });
});