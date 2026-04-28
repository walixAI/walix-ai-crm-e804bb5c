import type { TriggerType, ActionType, AutomationCondition, AutomationAction } from "./registry";

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, any>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabledByDefault: boolean;
  isDraft: boolean;
  recommended?: boolean;
}

export const TEMPLATES: AutomationTemplate[] = [
  {
    key: "follow_up_reminder",
    name: "Recordatorio de seguimiento",
    description: "Si un deal lleva varios días sin actividad, avísale al vendedor para que lo retome.",
    icon: "clock",
    triggerType: "deal_inactive",
    triggerConfig: { days: 5 },
    conditions: [],
    actions: [{ type: "notify_owner", config: { channel: "in_app", message: "Tu deal lleva 5 días sin actividad. ¡Dale seguimiento!" } }],
    enabledByDefault: true,
    isDraft: false,
    recommended: true,
  },
  {
    key: "auto_assign_leads",
    name: "Asignación automática de leads",
    description: "Cuando llega un lead nuevo por WhatsApp, asígnalo al vendedor con menos leads activos.",
    icon: "message-circle",
    triggerType: "new_whatsapp_lead",
    triggerConfig: {},
    conditions: [],
    actions: [{ type: "reassign_contact", config: { strategy: "round_robin" } }],
    enabledByDefault: true,
    isDraft: false,
  },
  {
    key: "welcome_message",
    name: "Mensaje de bienvenida",
    description: "Envía un mensaje cálido por WhatsApp en cuanto se registra un contacto nuevo.",
    icon: "user-plus",
    triggerType: "new_contact",
    triggerConfig: {},
    conditions: [],
    actions: [{ type: "send_whatsapp", config: { templateId: null } }],
    enabledByDefault: false,
    isDraft: true,
  },
  {
    key: "stalled_deal_alert",
    name: "Alerta de deal estancado",
    description: "Si un deal no avanza en 10 días, notifica al gerente para revisarlo en uno-a-uno.",
    icon: "x-circle",
    triggerType: "deal_inactive",
    triggerConfig: { days: 10 },
    conditions: [{ field: "deal.amount", operator: "gt", value: "5000" }],
    actions: [{ type: "notify_owner", config: { channel: "in_app_email", role: "manager" } }],
    enabledByDefault: true,
    isDraft: false,
  },
  {
    key: "celebrate_won",
    name: "Celebrar al ganar",
    description: "Al cerrar un deal en Ganado, agradece al cliente por WhatsApp y crea una tarea de onboarding.",
    icon: "trophy",
    triggerType: "deal_won",
    triggerConfig: {},
    conditions: [],
    actions: [
      { type: "send_whatsapp", config: { templateId: null } },
      { type: "create_task", config: { title: "Onboarding de cliente nuevo", dueInDays: 1 } },
    ],
    enabledByDefault: false,
    isDraft: true,
  },
  {
    key: "recover_lost",
    name: "Recuperar deal perdido",
    description: "Cuando un deal se pierde, agenda una tarea de revisión a 30 días para reintentar.",
    icon: "x-circle",
    triggerType: "deal_lost",
    triggerConfig: {},
    conditions: [],
    actions: [{ type: "create_task", config: { title: "Reintentar deal perdido", dueInDays: 30 } }],
    enabledByDefault: false,
    isDraft: true,
  },
  {
    key: "close_date_near",
    name: "Recordar cierre próximo",
    description: "Avisa al vendedor 3 días antes de la fecha esperada de cierre.",
    icon: "calendar-clock",
    triggerType: "deal_close_date_near",
    triggerConfig: { days: 3 },
    conditions: [],
    actions: [
      { type: "notify_owner", config: { channel: "in_app" } },
      { type: "create_task", config: { title: "Cerrar deal esta semana", dueInDays: 3 } },
    ],
    enabledByDefault: false,
    isDraft: true,
  },
  {
    key: "reengage_cold_contact",
    name: "Reactivar cliente frío",
    description: "Si un contacto lleva 14 días sin responder, envía una plantilla de re-engagement.",
    icon: "messages-square",
    triggerType: "contact_no_reply",
    triggerConfig: { days: 14 },
    conditions: [],
    actions: [{ type: "send_whatsapp", config: { templateId: null } }],
    enabledByDefault: false,
    isDraft: true,
    recommended: true,
  },
];

export function getTemplate(key: string) {
  return TEMPLATES.find((t) => t.key === key);
}