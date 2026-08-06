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
      "Enséñame a usar Walix paso a paso",
    ];
  }
  if (p.match(/^\/contacts\/[0-9a-f-]{36}/i)) {
    return [
      "¿Cuándo fue el último contacto con este lead?",
      "Crea una tarea de seguimiento para mañana",
      "Redacta un WhatsApp de seguimiento",
      "¿Qué puedo hacer desde la ficha de un contacto?",
    ];
  }
  if (p.startsWith("/contacts")) {
    return [
      "Top 5 contactos más activos esta semana",
      "¿Qué leads no han recibido respuesta?",
      "Crea un contacto nuevo",
      "¿Cómo importo mis clientes desde Excel?",
    ];
  }
  if (p.startsWith("/pipeline")) {
    return [
      "¿Qué oportunidades están en riesgo?",
      "Top 5 deals por monto",
      "¿Cuál es la conversión por etapa?",
      "¿Cómo funcionan las etapas del pipeline?",
    ];
  }
  if (p.startsWith("/whatsapp")) {
    return [
      "Resume esta conversación",
      "Sugiere una respuesta",
      "Crea un deal con este contacto",
      "¿Cómo funciona la ventana de 24 horas?",
    ];
  }
  if (p.startsWith("/expenses")) {
    return [
      "¿En qué estoy gastando este mes?",
      "¿Cuál es mi margen?",
      "¿Cómo registro un gasto recurrente?",
    ];
  }
  if (p.startsWith("/mi-dia")) {
    return [
      "¿Qué necesito hacer hoy?",
      "¿Cómo voy contra la meta del mes?",
      "¿Cómo registro un seguimiento?",
    ];
  }
  if (p.startsWith("/settings")) {
    return [
      "¿Cómo invito a un usuario?",
      "¿Cómo defino la meta del mes?",
      "¿Qué ve cada rol?",
    ];
  }
  return [
    "Top 5 leads más calientes",
    "¿Quién es mi contacto más activo?",
    "¿Qué necesito hacer hoy?",
    "¿Qué puedes hacer por mí?",
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