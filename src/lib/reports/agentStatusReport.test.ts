import { describe, it, expect } from "vitest";
import { buildAgentSummary, buildAgentStatusCSV, fmtTime } from "./agentStatusReport";
const rows = [
  { id: "1", user_id: "u", kind: "available", reason_name: "Disponible", started_at: "2026-11-21T15:00:00Z", ended_at: "2026-11-21T16:00:00Z", set_by: "u" },
  { id: "2", user_id: "u", kind: "pause", reason_name: "Coaching", started_at: "2026-11-21T16:00:00Z", ended_at: "2026-11-21T16:34:00Z", set_by: "u" },
  { id: "3", user_id: "u", kind: "offline", reason_name: "Desconectado", started_at: "2026-11-21T16:34:00Z", ended_at: null, set_by: "u" },
];
const range = { from: new Date("2026-11-21T06:00:00Z"), to: new Date("2026-11-22T05:59:59Z") };
const now = Date.parse("2026-11-21T18:00:00Z");
describe("reporte de estados", () => {
  it("pausa por coaching de 10:00 a 10:34 suma 34 minutos", () => {
    expect(buildAgentSummary(rows, range, {}, now)[0].byReason.Coaching).toBe(34);
  });
  it("registra primera conexión y última desconexión", () => {
    const s = buildAgentSummary(rows, range, {}, now)[0];
    expect(s.firstConnection).toBe("2026-11-21T15:00:00Z");
    expect(s.lastDisconnection).toBe("2026-11-21T16:34:00Z");
  });
  it("cuenta pausas que exceden su máximo", () => {
    expect(buildAgentSummary(rows, range, { Coaching: 30 }, now)[0].exceeded).toBe(1);
  });
  it("muestra los horarios en hora de México", () => {
    expect(fmtTime("2026-11-21T16:00:00Z")).toMatch(/10:00/);
    const csv = buildAgentStatusCSV(rows, [], new Map([["u", "Moises"]]), now);
    expect(csv).toContain('"Moises","Coaching","pause"');
    expect(csv).toMatch(/10:34/);
  });
});
