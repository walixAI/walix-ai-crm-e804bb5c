import { describe, expect, it } from "vitest";
import { filterOutcomes, type ActivityOutcome } from "./activityOutcomes";

/** Crea un resultado de seguimiento con los valores que el filtro necesita. */
function outcome(over: Partial<ActivityOutcome>): ActivityOutcome {
  return {
    id: "o1", pipelineId: "p1", stageId: null, activityKind: null, label: "Resultado",
    movesToStageId: null, requiresNextAction: false, position: 0, isActive: true,
    stageBehavior: "stay", isWon: false, isLost: false, isConnectionResult: false,
    ...over,
  };
}

const noAnswer = outcome({ id: "no-ans", label: "No contestó", activityKind: "llamada_saliente", isConnectionResult: true });
const voicemail = outcome({ id: "voicemail", label: "Buzón", activityKind: "llamada_saliente", isConnectionResult: true });
const connected = outcome({ id: "conn", label: "Contacto efectivo - sigue igual", activityKind: "llamada_saliente" });
const inboundOnly = outcome({ id: "in", label: "Llamada entrante atendida", activityKind: "llamada_entrante" });
const anyKind = outcome({ id: "any", label: "Interesado", activityKind: null });

describe("follow-up result options", () => {
  it("hides connection facts the provider already recorded from the advisor", () => {
    const labels = filterOutcomes([noAnswer, voicemail, connected, anyKind], null, "llamada_saliente").map((o) => o.label);
    expect(labels).not.toContain("No contestó");
    expect(labels).not.toContain("Buzón");
    expect(labels).toContain("Contacto efectivo - sigue igual");
  });

  it("does not offer call-only results when logging a WhatsApp follow-up", () => {
    const labels = filterOutcomes([noAnswer, connected, inboundOnly, anyKind], null, "whatsapp").map((o) => o.label);
    expect(labels).not.toContain("Contacto efectivo - sigue igual");
    expect(labels).not.toContain("Llamada entrante atendida");
    expect(labels).toContain("Interesado");
  });

  it("treats incoming and outgoing calls as the same family", () => {
    const labels = filterOutcomes([connected, inboundOnly, anyKind], null, "llamada_entrante").map((o) => o.label);
    expect(labels).toContain("Contacto efectivo - sigue igual");
    expect(labels).toContain("Llamada entrante atendida");
  });

  it("keeps inactive results out", () => {
    const labels = filterOutcomes([outcome({ id: "off", label: "Viejo", isActive: false }), anyKind], null, "note").map((o) => o.label);
    expect(labels).toEqual(["Interesado"]);
  });
});
