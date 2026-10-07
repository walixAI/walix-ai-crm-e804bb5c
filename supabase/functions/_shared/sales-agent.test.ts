import { describe, expect, it } from "vitest";
import { buildSystemPrompt, resolveGoal, resolveDealPipeline, handleInboundWithAgent } from "./sales-agent";

describe("Resolución del embudo de la oportunidad (regresión)", () => {
  it("deriva el pipeline desde la etapa de la oportunidad", () => {
    const deal = resolveDealPipeline({ id: "d1", stage_id: "s1", pipeline_stages: { pipeline_id: "p1" } });
    expect(deal?.pipeline_id).toBe("p1");
  });
  it("devuelve null si la etapa no trae pipeline (caso del fallo original)", () => {
    expect(resolveDealPipeline({ id: "d1", stage_id: "s1" })?.pipeline_id).toBeNull();
    expect(resolveDealPipeline(null)).toBeNull();
  });
  it("handleInboundWithAgent encuentra el agente cuando el pipeline viene de la etapa", async () => {
    const calls: string[] = [];
    const sb: any = {
      from: (table: string) => {
        calls.push(table);
        const chain: any = {
          select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
          maybeSingle: async () => {
            if (table === "deals") return { data: { id: "d1", stage_id: "s1", pipeline_stages: { pipeline_id: "p1" } }, error: null };
            if (table === "sales_agent_sessions") return { data: { id: "sess", state: "asesor" }, error: null };
            return { data: null, error: null };
          },
          then: (resolve: any) => resolve({
            data: table === "sales_agents" ? [{ id: "a1", tenant_id: "t1", pipeline_id: "p1", channels: { whatsapp: true } }] : [],
            error: null,
          }),
        };
        return chain;
      },
    };
    const res = await handleInboundWithAgent(sb, {
      tenantId: "t1", contactId: "c1", conversationId: "conv1",
      channel: { id: "ch1", access_token: null, phone_number_id: null }, to: "5215500000000",
    });
    // Debe llegar hasta la sesión (asesor_atiende), NO quedarse en sin_oportunidad.
    expect(res.skipped).toBe("asesor_atiende");
    expect(calls).toContain("sales_agents");
  });
});

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
  it("respeta Híbrida y consulta asistencia antes de canalizar", () => {
    expect(prompt).toContain("si puede o quiere asistir un par de horas a la semana a una sede de Utel");
    expect(prompt).toContain("Si no puede o no quiere, ofrece Online sin insistir");
    expect(prompt).toContain("registra por confirmar, sin asumir aceptación ni rechazo");
  });
  it("acuerda canal y horario sin inventar becas ni citas", () => {
    expect(prompt).toContain("prefiere llamada breve o información por WhatsApp");
    expect(prompt).toContain("No impongas llamada a quien eligió WhatsApp");
    expect(prompt).toContain("Un horario solicitado no es una cita confirmada");
    expect(prompt).toContain("No prometas mensajes automáticos a las dos horas");
  });
});