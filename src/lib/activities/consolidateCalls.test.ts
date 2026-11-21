import { describe, expect, it } from "vitest";
import { consolidateCallActivities, isEffectiveCall } from "./consolidateCalls";

const auto = { id: "auto", tenant_id: "tenant1", contact_id: "contact1", type: "call", description: "Llamada finalizada", occurred_at: "2026-11-17T22:49:59Z", metadata: { call_id: "call1", source: "automatic_call_result", result: "Llamada finalizada", status: "completed", duration: 43 } };
const analysis = { ...auto, id: "analysis", type: "note", description: "📞 Resumen IA de la llamada: Prueba de audio.", occurred_at: "2026-11-17T22:50:13Z", metadata: { call_id: "call1", source: "call_analysis" } };
const advisor = { ...auto, id: "advisor", description: "Se confirmó el audio.", occurred_at: "2026-11-17T22:51:00Z", metadata: { call_id: "call1", source: "advisor_call_follow_up", result: "Contacto efectivo - sigue igual", typification_id: "typ1", typification_label: "Interesado" } };

describe("one activity per call attempt", () => {
  it("reads termination evidence from the matching tenant/contact call, not advisor metadata", () => {
    const call = { id: "call1", tenant_id: "tenant1", contact_id: "contact1", hangup_by: "agent", hangup_at: "2026-11-21T20:25:00Z", ended_at: "2026-11-21T20:25:01Z" };
    const rows = consolidateCallActivities([auto, { ...advisor, metadata: { ...advisor.metadata, hangup_by: "prospect" } }], [call]);
    expect(rows[0].metadata).toMatchObject({ hangup_by: "agent", hangup_at: call.hangup_at, ended_at: call.ended_at });
    expect(consolidateCallActivities([auto], [{ ...call, tenant_id: "tenant2" }])[0].metadata).toMatchObject({ hangup_by: null, hangup_at: null });
    expect(consolidateCallActivities([auto], [{ ...call, contact_id: "other" }])[0].metadata).toMatchObject({ hangup_by: null, hangup_at: null });
  });
  it("keeps historical calls without fabricated termination evidence", () => {
    expect(consolidateCallActivities([auto])[0].metadata).toMatchObject({ hangup_by: null, hangup_at: null });
  });
  it("combines the answered 43-second call, AI summary and advisor result into one entry", () => {
    const rows = consolidateCallActivities([advisor, analysis, auto]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "advisor", type: "call", occurred_at: auto.occurred_at, description: advisor.description, metadata: { duration: 43, status: "completed", result: "Contacto efectivo - sigue igual", typification_id: "typ1", ai_summary: "Prueba de audio." } });
  });
  it("keeps separate attempts even for the same contact", () => {
    expect(consolidateCallActivities([auto, analysis, { ...auto, id: "auto2", metadata: { ...auto.metadata, call_id: "call2" } }])).toHaveLength(2);
  });
  it("never groups different tenants or contacts", () => {
    expect(consolidateCallActivities([auto, { ...auto, tenant_id: "tenant2" }, { ...auto, contact_id: "contact2" }])).toHaveLength(3);
  });
  it("keeps unlinked manual activities and does not mutate originals", () => {
    const original = JSON.stringify([auto, analysis, advisor]);
    const rows = consolidateCallActivities([auto, analysis, advisor, { ...auto, id: "manual", metadata: { call_id: "call1", source: "manual" } }]);
    expect(rows).toHaveLength(2);
    expect(JSON.stringify([auto, analysis, advisor])).toBe(original);
  });
  it("uses the latest advisor correction without adding an attempt", () => {
    const corrected = { ...advisor, id: "correction", occurred_at: "2026-11-17T23:00:00Z", metadata: { ...advisor.metadata, result: "Agendado" } };
    const rows = consolidateCallActivities([auto, advisor, corrected]);
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toMatchObject({ result: "Agendado", duration: 43 });
  });
});

describe("call attempt classification", () => {
  it("marks a 43-second completed call as effective", () => {
    expect(isEffectiveCall({ status: "completed", duration: 43 }, "Pidió cotización.")).toBe(true);
  });
  it("marks calls that never connected as attempts", () => {
    expect(isEffectiveCall({ status: "no_answer", duration: 0 }, "")).toBe(false);
    expect(isEffectiveCall({ status: "busy", duration: 0 }, "")).toBe(false);
    expect(isEffectiveCall({ status: "failed", duration: 0 }, "")).toBe(false);
    expect(isEffectiveCall({ status: "completed", duration: 0 }, "")).toBe(false);
    expect(isEffectiveCall({ status: "voicemail", duration: 0 }, "")).toBe(false);
  });
  it("labels the consolidated entry as an attempt or an effective call", () => {
    const attempt = { ...auto, metadata: { ...auto.metadata, status: "no_answer", duration: 0 } };
    const rows = consolidateCallActivities([attempt] as any[]);
    const done = consolidateCallActivities([auto] as any[]);
    expect(rows[0].metadata.is_effective).toBe(false);
    expect(done[0].metadata.is_effective).toBe(true);
  });
});