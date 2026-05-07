export interface CopilotContext {
  pathname: string;
  entityType?: "deal" | "contact" | "convo" | null;
  entityId?: string | null;
}

export function getCopilotSuggestions(ctx: CopilotContext): string[] {
  const p = ctx.pathname;
  if (p.startsWith("/dashboard")) {
    return [
      "¿Cuánto vale mi pipeline hoy?",
      "¿Qué deals cierran esta semana?",
      "Resume las conversaciones sin responder",
    ];
  }
  if (p.match(/^\/contacts\/[0-9a-f-]{36}/i)) {
    return [
      "¿Cuándo fue el último contacto con este lead?",
      "Crea una tarea de seguimiento para mañana",
      "Redacta un WhatsApp de seguimiento",
    ];
  }
  if (p.startsWith("/contacts")) {
    return [
      "Top 5 contactos más activos esta semana",
      "¿Qué leads no han recibido respuesta?",
      "Crea un contacto nuevo",
    ];
  }
  if (p.startsWith("/pipeline")) {
    return [
      "¿Qué oportunidades están en riesgo?",
      "Top 5 deals por monto",
      "¿Cuál es la conversión por etapa?",
    ];
  }
  if (p.startsWith("/whatsapp")) {
    return [
      "Resume esta conversación",
      "Sugiere una respuesta",
      "Crea un deal con este contacto",
    ];
  }
  return [
    "Top 5 leads más calientes",
    "¿Quién es mi contacto más activo?",
    "¿Qué necesito hacer hoy?",
  ];
}

export function deriveConversationKey(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  const contactMatch = pathname.match(/^\/contacts\/([0-9a-f-]{36})/i);
  if (contactMatch) return `contact:${contactMatch[1]}`;
  if (pathname.startsWith("/pipeline")) {
    const id = params.get("dealId");
    if (id) return `deal:${id}`;
    return "pipeline";
  }
  if (pathname.startsWith("/whatsapp")) {
    const id = params.get("conversationId");
    if (id) return `convo:${id}`;
    return "whatsapp";
  }
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "global";
}

export function deriveEntity(pathname: string, search: string):
  | { type: "contact" | "deal" | "conversation"; id: string }
  | null {
  const params = new URLSearchParams(search);
  const contactMatch = pathname.match(/^\/contacts\/([0-9a-f-]{36})/i);
  if (contactMatch) return { type: "contact", id: contactMatch[1] };
  if (pathname.startsWith("/pipeline")) {
    const id = params.get("dealId");
    if (id) return { type: "deal", id };
  }
  if (pathname.startsWith("/whatsapp")) {
    const id = params.get("conversationId");
    if (id) return { type: "conversation", id };
  }
  return null;
}