import { describe, expect, it } from "vitest";
import { buildCallsReport, buildCallsReportCSV, type CallsReportRow } from "./callsReport";

const base = (over: Partial<CallsReportRow>): CallsReportRow => ({
  id: over.id ?? "c-" + Math.random().toString(36).slice(2),
  direction: "outbound",
  status: "completed",
  duration_seconds: 0,
  answered_at: null,
  created_at: "2026-11-20T18:00:00Z",
  user_id: null,
  contact_id: null,
  ...over,
});

describe("buildCallsReport", () => {
  it("resume salientes con datos reales de Refrigeración: 18 marcadas, 9 con duración", () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => base({ id: `o${i}`, duration_seconds: 42, answered_at: "2026-11-20T18:00:00Z", user_id: "qa" })),
      ...Array.from({ length: 9 }, (_, i) => base({ id: `f${i}`, status: i % 3 === 0 ? "voicemail" : "failed", user_id: "qa" })),
    ];
    const report = buildCallsReport(rows);
    expect(report.outbound.total).toBe(18);
    expect(report.outbound.effective).toBe(9);
    expect(report.outbound.attempts).toBe(9);
    expect(report.outbound.rate).toBe(50);
    expect(report.outbound.perEffective).toBe("1.0");
  });

  it("cuenta entrantes recibidas, atendidas y no atendidas por separado", () => {
    const rows = [
      base({ id: "i1", direction: "inbound", status: "no_answer", from_number: "+525511112222" }),
      base({ id: "i2", direction: "inbound", status: "no_answer", from_number: "+525533334444" }),
      base({ id: "i3", direction: "inbound", status: "completed", answered_at: "2026-11-21T00:51:00Z", duration_seconds: 30 }),
    ];
    const report = buildCallsReport(rows);
    expect(report.inbound.received).toBe(3);
    expect(report.inbound.answered).toBe(1);
    expect(report.inbound.missed).toBe(2);
    expect(report.inbound.attentionRate).toBe(33);
  });

  it("agrupa por responsable y deja sin asignar las llamadas sin asesor", () => {
    const rows = [
      base({ id: "o1", user_id: "moises", duration_seconds: 60, answered_at: "2026-11-20T18:00:00Z" }),
      base({ id: "o2", user_id: "moises", status: "failed" }),
      base({ id: "i1", direction: "inbound", status: "no_answer", user_id: "moises" }),
      base({ id: "i2", direction: "inbound", status: "no_answer" }),
    ];
    const report = buildCallsReport(rows);
    expect(report.byAdvisor).toHaveLength(2);
    const moises = report.byAdvisor.find((a) => a.advisorId === "moises");
    expect(moises?.outboundTotal).toBe(2);
    expect(moises?.outboundEffective).toBe(1);
    expect(moises?.outboundRate).toBe(50);
    expect(moises?.inboundReceived).toBe(1);
    expect(moises?.inboundMissed).toBe(1);
    const unassigned = report.byAdvisor.find((a) => a.advisorId === null);
    expect(unassigned?.advisorName).toBe("Grupo de recepción · sin asignar");
    expect(unassigned?.inboundMissed).toBe(1);
  });

  it("sin llamadas efectivas la tasa es 0 y el promedio de intentos no se inventa", () => {
    const report = buildCallsReport([base({ id: "x", status: "no_answer" })]);
    expect(report.outbound.rate).toBe(0);
    expect(report.outbound.perEffective).toBe("—");
  });

  it("el CSV incluye resumen, responsables y el número de cada no atendida", () => {
    const rows = [base({ id: "i1", direction: "inbound", status: "no_answer", from_number: "+525511112222", user_id: "moises" })];
    const csv = buildCallsReportCSV(buildCallsReport(rows), rows, { periodLabel: "Este mes", tenantName: "Refrigeración GyR" });
    expect(csv).toContain("Refrigeración GyR");
    expect(csv).toContain("Este mes");
    expect(csv).toContain("+525511112222");
    expect(csv).toContain("Por responsable");
  });
});
