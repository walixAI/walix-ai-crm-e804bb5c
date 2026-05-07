# Plan: Memoria persistente de IA

Infraestructura de contexto que persiste entre sesiones para alimentar el copiloto, sugerencias proactivas y prompts enriquecidos.

## 1. Migración de base de datos

Adaptaciones necesarias respecto al SQL propuesto:
- No existe tabla `users`; las FKs de "usuario" apuntarán a `auth.users(id)` (mismo patrón usado en el resto del proyecto vía `profiles.id`).
- Las políticas RLS usarán el helper existente `get_user_tenant(auth.uid())` y `is_platform(auth.uid())` — no `auth.jwt()->>'tenant_id'` (ese claim no está poblado en este proyecto).
- Trigger `set_updated_at` en `ai_entity_context`.

### Tablas

**`ai_entity_context`** — Resumen vivo por entidad (contact|deal|conversation|team) con `context_summary`, `key_facts JSONB`, `sentiment`, `urgency_score`, `last_interaction`. UNIQUE(tenant_id, entity_type, entity_id).

**`ai_memory_events`** — Log inmutable de eventos (`wa_message_sent`, `wa_message_received`, `deal_stage_changed`, `note_added`, `deal_created`, `contact_updated`, `task_completed`, …). `actor_id` → `auth.users(id)`.

**`ai_proactive_suggestions`** — Sugerencias generadas sin pregunta: `suggestion_text`, `action_type` (`send_whatsapp|move_deal|create_task|schedule_followup`), `action_payload`, `priority 1-10`, `expires_at` default +24h, flags `acted_on`/`dismissed`.

**`ai_conversation_history`** — Historial del copiloto (AiPromptBar) con `session_id`, `role` (`user|assistant|tool`), `content`, `tool_calls`, `context_snapshot`.

### Índices
Los 4 índices propuestos tal cual.

### RLS (todas las tablas)
- `SELECT`: `tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid())`
- `INSERT`: `tenant_id = get_user_tenant(auth.uid())`
- `UPDATE/DELETE`: `tenant_id = get_user_tenant(auth.uid())`
- En `ai_proactive_suggestions` además limitamos `UPDATE` a `target_user_id = auth.uid()` o admin/owner del tenant.
- En `ai_conversation_history` limitamos lectura a `user_id = auth.uid()` (más privacidad) + admins del tenant.

### Trigger de auto-actualización
Función `update_ai_context_from_event()` que tras cada `INSERT` en `ai_memory_events` haga `UPSERT` mínimo en `ai_entity_context` (actualiza `last_interaction = NEW.created_at` y mantiene `updated_at`). El enriquecimiento semántico (`context_summary`, `key_facts`, `sentiment`, `urgency_score`) lo hace una edge function aparte (siguiente iteración).

## 2. Servicio: `src/services/aiMemory.ts`

```text
aiMemory.getContext(entityType, entityId): Promise<EntityContext | null>
aiMemory.logEvent(entityType, entityId, eventType, data): Promise<void>
aiMemory.getProactiveSuggestions(userId): Promise<Suggestion[]>
aiMemory.actOnSuggestion(suggestionId, acted: boolean): Promise<void>
aiMemory.buildSystemPrompt(ctx: EntityContext, userRole: string): string
```

- `logEvent` inserta en `ai_memory_events`; el trigger refresca `last_interaction`.
- `getProactiveSuggestions` filtra `dismissed=false AND expires_at > now() AND (target_user_id = userId OR target_user_id IS NULL)`, ordena por `priority DESC, created_at DESC`.
- `buildSystemPrompt` arma un bloque de contexto en español que incluye resumen, top 5 `key_facts`, último sentimiento y urgencia, y modula instrucciones según `userRole` (vendedor vs. tenant_admin/owner).
- Tipos exportados (`EntityContext`, `Suggestion`, `EventType`, `EntityType`) compartidos.

## 3. Hooks: `src/hooks/useAiMemory.ts`

- `useEntityContext(entityType, entityId)` — React Query con `refetchInterval: 30_000`.
- `useProactiveSuggestions()` — usa `useAuth` para tomar `userId`; `refetchInterval: 60_000`; expone `actOn(id, acted)` y `dismiss(id)` con invalidación.
- `useAiMemoryLogger()` — devuelve `logEvent` memoizado (mutación) para usar en componentes (DealDrawer, Composer, TasksTab, etc.).

## 4. Integraciones (mínimas en este paso)

Para validar la capa sin romper flujos existentes, agregamos llamadas a `logEvent` en:
- `Composer` de WhatsApp (mensaje saliente → `wa_message_sent`).
- `whatsapp-webhook` edge function (entrante → `wa_message_received`).
- `KanbanBoard`/`DealDrawer` al cambiar stage → `deal_stage_changed`.
- `QuickTaskDialog` al completar tarea → `task_completed`.

Las edge functions de IA (`global-ai`, `contact-ai-suggest`, `pipeline-ai`) **no** se modifican aún; el consumo de `buildSystemPrompt` y de las sugerencias proactivas se hará en el siguiente prompt para mantener este cambio enfocado en infraestructura.

## 5. Archivos

- **Crear migración:** tablas + índices + RLS + trigger.
- **Crear:** `src/services/aiMemory.ts`, `src/hooks/useAiMemory.ts`.
- **Editar:** `src/components/whatsapp/Composer.tsx`, `src/components/pipeline/KanbanBoard.tsx` (o `DealDrawer.tsx` donde vive el cambio de stage), `src/components/pipeline/QuickTaskDialog.tsx`, `supabase/functions/whatsapp-webhook/index.ts`.

## Fuera de alcance (próxima iteración)
- Edge function `ai-memory-enrich` que recalcula `context_summary`/`sentiment`/`urgency_score` con LLM tras N eventos.
- Generación automática de `ai_proactive_suggestions` (cron horario).
- UI para mostrar sugerencias proactivas en Dashboard / AiDrawer.
- Wire de `buildSystemPrompt` en las edge functions de IA existentes.
