import { describe, expect, it } from "vitest";
import { enrichProspectBrief } from "./prospect-brief";

describe("Ficha unificada del prospecto", () => {
  const brief = { close_probability: { pct: 55, reason: "Interés sin compromiso confirmado" } };
  const sessions = [{ agent_id: "a", score: 75, profile_data: { institucion: "Universidad", cargo: "Director" } }];
  const agents = [{ id: "a", profiling_fields: [{ key: "institucion", label: "Institución" }, { key: "cargo", label: "Cargo" }] }];
  it("usa la probabilidad registrada, no la completitud del perfil", () => {
    const result = enrichProspectBrief(brief, [{ id: "d", name: "Sesión", probability: 40 }], sessions, agents);
    expect(result.close_probability.pct).toBe(40);
    expect(result.profile_completeness).toBe(75);
    expect(result.profile).toContainEqual({ key: "cargo", label: "Cargo", value: "Director" });
  });
  it("conserva oportunidades independientes y estados terminales", () => {
    const result = enrichProspectBrief(brief, [{ id: "d1", name: "Una", probability: 40 }, { id: "d2", name: "Otra", probability: 90, is_lost: true }], [], []);
    expect(result.deal_probabilities.map((d: any) => d.pct)).toEqual([40, 0]);
  });
  it("no inventa perfil y respeta el valor más reciente", () => {
    const result = enrichProspectBrief(brief, [], [...sessions, { ...sessions[0], profile_data: { cargo: "Asesor" } }], agents);
    expect(result.profile.find((f: any) => f.key === "cargo")?.value).toBe("Director");
    expect(enrichProspectBrief(brief, [], [], []).profile).toEqual([]);
  });
});