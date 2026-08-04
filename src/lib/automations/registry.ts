/**
 * Catálogo de triggers, acciones, operadores y campos para el módulo de
 * Automatizaciones. Mantenerlo aquí permite que UI, IA y edge functions
 * compartan una sola fuente de verdad.
 */
import {
  Clock, MessageCircle, UserPlus, ArrowRight, Trophy, XCircle, CalendarClock,
  MessagesSquare, Send, Bell, ListTodo, Users, Tag, ArrowRightCircle,
  type LucideIcon,
} from "lucide-react";

export type TriggerType =
  | "deal_inactive"
  | "new_whatsapp_lead"
  | "new_contact"
  | "deal_stage_changed"
  | "deal_won"
  | "deal_lost"
  | "deal_close_date_near"
  | "contact_no_reply"
  | "recurrence_due"
  | "recurrence_completed";

export type ActionType =
  | "send_whatsapp"
  | "notify_owner"
  | "create_task"
  | "reassign_contact"
  | "add_tag"
  | "move_deal_stage"
  | "create_recurrence_occurrence"
  | "schedule_next_recurrence";

export type ConditionOperator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";

export interface TriggerDef {
  type: TriggerType;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Campos de configuración solicitados al usuario en el builder */
  config: { key: string; label: string; kind: "number" | "stage_from" | "stage_to" | "select"; default?: any; options?: { label: string; value: string }[]; suffix?: string }[];
  /** ¿Este trigger se evalúa por cron (true) o se dispara reactivamente (false)? */
  scheduled: boolean;
}

export interface ActionDef {
  type: ActionType;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const TRIGGERS: TriggerDef[] = [
  {
    type: "deal_inactive",
    icon: Clock,
    title: "Un deal lleva días sin actividad",
    description: "Se dispara si un deal abierto no tuvo movimientos.",
    scheduled: true,
    config: [{ key: "days", label: "Días sin actividad", kind: "number", default: 5, suffix: "días" }],
  },
  {
    type: "new_whatsapp_lead",
    icon: MessageCircle,
    title: "Llega un nuevo lead por WhatsApp",
    description: "Cuando se crea una conversación nueva desde WhatsApp.",
    scheduled: false,
    config: [],
  },
  {
    type: "new_contact",
    icon: UserPlus,
    title: "Se crea un contacto nuevo",
    description: "Cualquier contacto nuevo agregado al CRM.",
    scheduled: false,
    config: [],
  },
  {
    type: "deal_stage_changed",
    icon: ArrowRight,
    title: "Un deal cambia de etapa",
    description: "Cuando un deal se mueve entre etapas del pipeline.",
    scheduled: false,
    config: [
      { key: "fromStageId", label: "Desde la etapa", kind: "stage_from", default: "any" },
      { key: "toStageId", label: "Hacia la etapa", kind: "stage_to", default: "any" },
    ],
  },
  {
    type: "deal_won",
    icon: Trophy,
    title: "Un deal se marca como Ganado",
    description: "Perfecto para celebraciones automáticas o seguimiento post-venta.",
    scheduled: false,
    config: [],
  },
  {
    type: "deal_lost",
    icon: XCircle,
    title: "Un deal se marca como Perdido",
    description: "Útil para campañas de recuperación o análisis.",
    scheduled: false,
    config: [],
  },
  {
    type: "deal_close_date_near",
    icon: CalendarClock,
    title: "Se acerca la fecha de cierre",
    description: "Recuérdale al vendedor antes de la fecha esperada.",
    scheduled: true,
    config: [{ key: "days", label: "Días antes del cierre", kind: "number", default: 3, suffix: "días" }],
  },
  {
    type: "contact_no_reply",
    icon: MessagesSquare,
    title: "Un contacto no responde hace días",
    description: "Detecta conversaciones frías para reactivarlas.",
    scheduled: true,
    config: [{ key: "days", label: "Días sin respuesta", kind: "number", default: 7, suffix: "días" }],
  },
];

export const ACTIONS: ActionDef[] = [
  { type: "send_whatsapp", icon: Send, title: "Enviar mensaje de WhatsApp", description: "Envía una plantilla aprobada al contacto." },
  { type: "notify_owner", icon: Bell, title: "Notificar al vendedor", description: "Avisa por la campana y por correo al responsable." },
  { type: "create_task", icon: ListTodo, title: "Crear una tarea", description: "Genera un pendiente con fecha y asignado." },
  { type: "reassign_contact", icon: Users, title: "Reasignar el contacto", description: "Cambia el responsable o usa round-robin." },
  { type: "add_tag", icon: Tag, title: "Agregar una etiqueta", description: "Etiqueta al contacto para segmentar." },
  { type: "move_deal_stage", icon: ArrowRightCircle, title: "Mover deal de etapa", description: "Avanza el deal al siguiente paso del pipeline." },
];

export const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "eq", label: "es igual a" },
  { value: "neq", label: "es distinto de" },
  { value: "gt", label: "es mayor que" },
  { value: "gte", label: "es mayor o igual que" },
  { value: "lt", label: "es menor que" },
  { value: "lte", label: "es menor o igual que" },
  { value: "contains", label: "contiene" },
  { value: "in", label: "está en" },
];

export const CONDITION_FIELDS: { value: string; label: string; kind: "number" | "text" | "select"; options?: string[] }[] = [
  { value: "deal.amount", label: "Monto del deal", kind: "number" },
  { value: "deal.probability", label: "Probabilidad del deal (%)", kind: "number" },
  { value: "deal.stage_name", label: "Etapa del deal", kind: "text" },
  { value: "deal.source", label: "Fuente del deal", kind: "select", options: ["WhatsApp", "Manual", "Web", "Facebook", "Referido"] },
  { value: "contact.status", label: "Estado del contacto", kind: "text" },
  { value: "contact.source", label: "Fuente del contacto", kind: "select", options: ["WhatsApp", "Manual", "Web", "Facebook", "Referido"] },
  { value: "contact.company", label: "Empresa del contacto", kind: "text" },
];

export function getTrigger(type: string): TriggerDef | undefined {
  return TRIGGERS.find((t) => t.type === type);
}
export function getAction(type: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.type === type);
}

export interface AutomationCondition { field: string; operator: ConditionOperator; value: string; logic?: "AND" | "OR"; }
export interface AutomationAction { type: ActionType; config: Record<string, any>; }