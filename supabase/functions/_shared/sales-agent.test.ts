import { describe, expect, it } from "vitest";
import { buildSystemPrompt, resolveGoal } from "./sales-agent";

describe("Reglas de conversación del agente", () => {
  const agent = {
    name: "Arlett", default_goal: "Orientar y agendar una llamada",
    default_key_message: "Híbrida primero", format_rules: {},
    profiling_fields: [{ key: "nombre", label: "Nombre" }],
    examples: "¡Excelente elección! ¿En qué más te puedo ayudar?",
  };
  const prompt = buildSystemPrompt(agent, resolveGoal(agent, [], {}), [], "test");

  it("mantiene el objetivo y la prioridad configurados", () => {
    expect(prompt).toContain("OBJETIVO ACTUAL: Orientar y agendar una llamada");
    expect(prompt).toContain("Mensaje clave: Híbrida primero");
  });
  it("define ritmo, límites y validación antes de costos", () => {
    expect(prompt).toContain("dos o tres oraciones cortas como máximo");
    expect(prompt).toContain("Una sola pregunta clara a la vez");
    expect(prompt).toContain("certificado de bachillerato terminado");
    expect(prompt).toContain("Prohibidas las cortesías mecánicas");
    expect(prompt).toContain("prevalecen esas reglas");
  });
  it("no permite hacerse pasar por humano", () => {
    expect(prompt).toContain("responde con honestidad");
    expect(prompt).not.toContain("Eres una persona real");
    expect(prompt).not.toContain("Nunca menciones que eres asistente virtual");
  });
  it("no inicia el perfilamiento solicitando el nombre completo", () => {
    expect(prompt).toContain("nunca pidiendo nombre completo, edad o ciudad");
    expect(prompt).toContain("Pres\u00e9ntate en el primer mensaje con nombre y cargo de forma natural");
    expect(prompt).toContain("Si ya mencionó una carrera o una duda, responde a eso");
  });
});