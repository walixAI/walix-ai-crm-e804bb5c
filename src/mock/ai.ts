/**
 * Mock data + helpers for the Walix.ai generative layer.
 * In production this is replaced by /src/services/ai.ts → Anthropic Claude.
 */

export type AiSuggestionType =
  | "contact_suggestion"
  | "deal_suggestion"
  | "pipeline_alert";

export interface AiSuggestion {
  id: string;
  type: AiSuggestionType;
  text: string;
  cta?: { label: string; action: "whatsapp" | "move_stage" | "task" | "open" };
  urgency?: "low" | "medium" | "high";
  updatedAt: string; // ISO
}

export const aiSuggestionsByType: Record<AiSuggestionType, AiSuggestion[]> = {
  contact_suggestion: [
    {
      id: "c1",
      type: "contact_suggestion",
      text: "Lleva 3 días sin contestar. Envíale el catálogo PDF que pidió y pregunta si necesita la cotización formal.",
      cta: { label: "Enviar por WhatsApp", action: "whatsapp" },
      urgency: "medium",
      updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
    {
      id: "c2",
      type: "contact_suggestion",
      text: "Mostró interés en el paquete premium pero objetó precio. Ofrece plan de pagos a 3 meses.",
      cta: { label: "Sugerir respuesta", action: "whatsapp" },
      urgency: "high",
      updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    },
  ],
  deal_suggestion: [
    {
      id: "d1",
      type: "deal_suggestion",
      text: "El cliente abrió la propuesta 3 veces hoy. Es buen momento para llamar y cerrar.",
      cta: { label: "Mover a Negociación", action: "move_stage" },
      urgency: "high",
      updatedAt: new Date(Date.now() - 90_000).toISOString(),
    },
    {
      id: "d2",
      type: "deal_suggestion",
      text: "Lleva 8 días en Cotización sin movimiento. Agenda una llamada de seguimiento.",
      cta: { label: "Crear tarea", action: "task" },
      urgency: "medium",
      updatedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    },
  ],
  pipeline_alert: [
    {
      id: "p1",
      type: "pipeline_alert",
      text: "3 deals llevan más de 10 días sin actividad y suman $124k MXN.",
      urgency: "high",
      updatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    },
    {
      id: "p2",
      type: "pipeline_alert",
      text: "Hay 5 leads nuevos sin atender hace más de 2h.",
      urgency: "medium",
      updatedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    },
  ],
};

/**
 * Score 0-100 mock — combines days in stage + recent activity.
 * Used as a deterministic placeholder for the real model output.
 */
export function mockDealScore(input: {
  daysInStage: number;
  daysSinceLastActivity: number;
  openedProposalCount?: number;
  responseTimeHours?: number;
}): { score: number; reason: string } {
  let score = 60;
  if (input.responseTimeHours !== undefined && input.responseTimeHours < 2) score += 15;
  if ((input.openedProposalCount ?? 0) >= 3) score += 12;
  if (input.daysInStage <= 2) score += 8;
  else if (input.daysInStage > 10) score -= 20;
  if (input.daysSinceLastActivity <= 1) score += 5;
  else if (input.daysSinceLastActivity > 7) score -= 18;
  score = Math.max(5, Math.min(98, score));

  const parts: string[] = [];
  if (input.responseTimeHours !== undefined && input.responseTimeHours < 2) parts.push("Respondió en <2h");
  if ((input.openedProposalCount ?? 0) >= 3) parts.push(`abrió propuesta ${input.openedProposalCount} veces`);
  parts.push(`lleva ${input.daysInStage} día${input.daysInStage === 1 ? "" : "s"} en esta etapa`);
  if (input.daysSinceLastActivity > 7) parts.push(`${input.daysSinceLastActivity} días sin actividad`);

  return { score, reason: `${score}% — ${parts.join(", ")}` };
}

/**
 * Returns a hardcoded but realistic answer for a free-form prompt.
 * Used as fallback when the real AI service is unavailable.
 */
export function mockAiResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("caliente") || p.includes("lead")) {
    return `**Tus 5 leads más calientes ahora:**\n\n1. **Restaurante La Plaza** — Cotización de $42k, respondió hace 2h.\n2. **Hotel Misión** — Pidió propuesta formal, score 94/100.\n3. **Lucía Hernández** — Lleva 3 mensajes sin cerrar, pregunta por entrega.\n4. **Pedro Sánchez** — Confirmó transferencia, cierra hoy.\n5. **Distribuidora Norte** — Demo agendada esta semana.\n\n*Sugerencia: enfócate en 1, 2 y 4 antes de las 6pm.*`;
  }
  if (p.includes("pipeline") || p.includes("vale")) {
    return `**Tu pipeline activo vale $248,500 MXN.**\n\n- 23 deals abiertos · 8 sin actividad hoy\n- Etapa con más valor: **Propuesta** ($124k)\n- Tasa de cierre proyectada: **34%** → ~$84k cerrarían este mes\n\n*Riesgo: 3 deals llevan más de 10 días estancados.*`;
  }
  if (p.includes("vendedor") || p.includes("equipo")) {
    return `**Top vendedores esta semana:**\n\n1. **María López** — 28 cierres · $124.5k\n2. **Carlos Ruiz** — 24 cierres · $108.2k\n3. **Ana Torres** — 19 cierres · $89.4k\n\nMaría va 15% arriba de su meta mensual.`;
  }
  if (p.includes("riesgo")) {
    return `**Deals en riesgo (3):**\n\n- **Hotel Misión** — 12 días sin actividad · $48k\n- **Distribuidora Norte** — Cliente no abrió la última propuesta · $36k\n- **Café del Sur** — Bajó la frecuencia de mensajes 60% · $22k`;
  }
  return `Analicé tus datos. Aquí lo más relevante para **"${prompt}"**:\n\n- Tienes 47 conversaciones de WhatsApp hoy, 12 sin responder.\n- Pipeline activo de $248,500 MXN con 23 deals.\n- 3 deals llevan +10 días sin actividad — revísalos.\n\n¿Quieres que profundice en alguno?`;
}

export const QUICK_AI_PROMPTS = [
  "¿Cuánto vale mi pipeline hoy?",
  "¿Qué deals están en riesgo?",
  "¿Quién es mi contacto más activo esta semana?",
  "Muéstrame los 5 leads más calientes",
  "Resume las conversaciones sin responder",
];