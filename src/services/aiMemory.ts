import { supabase } from "@/integrations/supabase/client";

export type EntityType = "contact" | "deal" | "conversation" | "team";
export type Sentiment = "positive" | "neutral" | "negative" | "unknown";
export type EventType =
  | "wa_message_sent"
  | "wa_message_received"
  | "deal_stage_changed"
  | "note_added"
  | "deal_created"
  | "contact_updated"
  | "task_completed"
  | (string & {});
export type ActionType =
  | "send_whatsapp"
  | "move_deal"
  | "create_task"
  | "schedule_followup"
  | (string & {});

export interface EntityContext {
  id: string;
  tenant_id: string;
  entity_type: EntityType;
  entity_id: string;
  context_summary: string;
  key_facts: any[];
  last_interaction: string | null;
  sentiment: Sentiment;
  urgency_score: number;
  updated_at: string;
  created_at: string;
}

export interface ProactiveSuggestion {
  id: string;
  tenant_id: string;
  target_user_id: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  suggestion_text: string;
  action_type: ActionType | null;
  action_payload: Record<string, any>;
  priority: number;
  shown_at: string | null;
  acted_on: boolean;
  dismissed: boolean;
  expires_at: string;
  created_at: string;
}

// `ai_*` tables are not yet in the generated types; cast through `any`.
const db = supabase as any;

async function getActiveTenantId(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("active_tenant_id, tenant_id")
    .eq("id", u.user.id)
    .maybeSingle();
  return data?.active_tenant_id ?? data?.tenant_id ?? null;
}

export const aiMemory = {
  async getContext(entityType: EntityType, entityId: string): Promise<EntityContext | null> {
    const { data, error } = await db
      .from("ai_entity_context")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();
    if (error) throw error;
    return (data as EntityContext | null) ?? null;
  },

  async logEvent(
    entityType: EntityType,
    entityId: string,
    eventType: EventType,
    data: Record<string, any> = {}
  ): Promise<void> {
    const tenant_id = await getActiveTenantId();
    if (!tenant_id) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("ai_memory_events").insert({
      tenant_id,
      entity_type: entityType,
      entity_id: entityId,
      event_type: eventType,
      event_data: data,
      actor_id: u.user?.id ?? null,
    });
    if (error) {
      // No bloquear el flujo si falla el logging.
      // eslint-disable-next-line no-console
      console.warn("[aiMemory] logEvent failed", error);
    }
  },

  async getProactiveSuggestions(userId: string): Promise<ProactiveSuggestion[]> {
    const nowIso = new Date().toISOString();
    const { data, error } = await db
      .from("ai_proactive_suggestions")
      .select("*")
      .eq("dismissed", false)
      .gt("expires_at", nowIso)
      .or(`target_user_id.eq.${userId},target_user_id.is.null`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ProactiveSuggestion[];
  },

  async actOnSuggestion(suggestionId: string, acted: boolean): Promise<void> {
    const patch = acted
      ? { acted_on: true, dismissed: true }
      : { dismissed: true };
    const { error } = await db
      .from("ai_proactive_suggestions")
      .update(patch)
      .eq("id", suggestionId);
    if (error) throw error;
  },

  buildSystemPrompt(ctx: EntityContext, userRole: string): string {
    const facts = Array.isArray(ctx.key_facts) ? ctx.key_facts.slice(0, 5) : [];
    const factsBlock = facts.length
      ? facts
          .map((f) => `- ${typeof f === "string" ? f : JSON.stringify(f)}`)
          .join("\n")
      : "- (sin hechos clave registrados)";

    const isAdmin =
      userRole === "tenant_owner" ||
      userRole === "tenant_admin" ||
      userRole === "platform_owner" ||
      userRole === "platform_staff";

    const roleNote = isAdmin
      ? "El usuario es administrador: puedes proponer cambios de configuración (fuentes, etapas, pipelines) además de acciones operativas."
      : "El usuario es vendedor: limita las propuestas a gestionar contactos, oportunidades, tareas y mensajes.";

    return [
      "Contexto persistente de memoria de IA:",
      `- Entidad: ${ctx.entity_type} (${ctx.entity_id})`,
      `- Sentimiento: ${ctx.sentiment} | Urgencia: ${ctx.urgency_score}/100`,
      `- Último contacto: ${ctx.last_interaction ?? "sin registrar"}`,
      "",
      "Resumen:",
      ctx.context_summary?.trim() ? ctx.context_summary : "(sin resumen aún)",
      "",
      "Hechos clave:",
      factsBlock,
      "",
      roleNote,
    ].join("\n");
  },
};

export type { EntityContext as AiEntityContext };