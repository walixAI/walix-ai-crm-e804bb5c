
# Plan: Sistema de Agentes Autónomos Walix.ai

Reusa el motor agéntico del copiloto (`ai-copilot/index.ts` ya tiene CRM_TOOLS + executor + loop) extrayéndolo a un módulo compartido en `_shared/`, y monta un runner programado por `pg_cron` que ejecuta agentes por tenant.

## 1. Migración de base de datos

**Tabla `ai_agents`** (multi-tenant, no FK directa a `tenants` porque el patrón del proyecto evita FK cross-schema; solo `tenant_id UUID NOT NULL`):
- Campos: `name`, `description`, `agent_type`, `system_prompt`, `schedule` (cron), `is_active`, `max_actions_per_run` (default 10), `allowed_tools TEXT[]`, `model TEXT` (default `google/gemini-2.5-flash`), `last_run_at`, `last_run_status`, `actions_taken_today`, `next_run_at`, `config JSONB`.
- Índice en `(is_active, next_run_at)` para el dispatcher.

**Tabla `ai_agent_runs`**:
- `agent_id`, `tenant_id`, `started_at`, `completed_at`, `status` (running/completed/failed/partial), `entities_processed`, `actions_taken`, `suggestions_created`, `error_message`, `run_log JSONB`.

**RLS** (siguiendo el patrón del proyecto):
- `ai_agents`: tenant select + admin/owner insert/update/delete.
- `ai_agent_runs`: tenant select; sin insert/update/delete por usuarios (solo service_role desde el runner).

**Función SQL `ai_run_due_agents()`** (`SECURITY DEFINER`):
- Selecciona agentes activos con `next_run_at <= now()`.
- Para cada uno hace `extensions.http_post` al edge `ai-agent-runner` con `{agent_id, tenant_id}` usando el service-role guardado en `app.settings.service_role_key` (ya existe el patrón en `notify_ai_context_updater`).
- Marca `next_run_at = NULL` para evitar dispatches duplicados; el runner recalcula `next_run_at` al terminar usando el cron.

**pg_cron**: `cron.schedule('walix-agents-dispatcher', '*/5 * * * *', $$ SELECT public.ai_run_due_agents() $$)`. Cada 5 min basta para granularidad de minuto.

## 2. Refactor: extraer motor del copiloto

Mover de `ai-copilot/index.ts` a `supabase/functions/_shared/ai-tools.ts`:
- Constante `CRM_TOOLS` (definiciones OpenAI function-calling).
- Función `executeTool(name, args, sb, tenantId, userId)`.
- Función `runAgenticLoop({ sb, tenantId, userId, systemPrompt, userMessage, allowedTools, model, maxIterations })` que devuelve `{ finalText, toolsUsed, pendingWhatsapp }`.

`ai-copilot` se reescribe como wrapper delgado sobre `runAgenticLoop`. Sin cambios funcionales para el copiloto.

## 3. Edge function `ai-agent-runner`

`supabase/functions/ai-agent-runner/index.ts`, `verify_jwt = false` (lo invoca pg_cron con service-role en el header).

**Flujo**:
1. Validar header `Authorization: Bearer <service-role-key>`.
2. Cargar agente + tenant. Si `is_active=false` → exit.
3. Resetear `actions_taken_today` si pasó la medianoche (CDMX).
4. Crear fila en `ai_agent_runs` con `status='running'`.
5. **Selector de entidades** según `agent_type`:
   - `followup_watchdog`: `deals` activos (no won/lost) con `ai_entity_context.last_interaction < now()-5d` o sin contexto + `created_at < now()-5d`.
   - `lead_qualifier`: `contacts` con `status='Nuevo'` y `created_at >= now()-24h`.
   - `deal_risk_detector`: `deals` activos cuyo `stage_name ILIKE '%propuesta%'` o `'%negocia%'` y `urgency_score > 60` (join con `ai_entity_context`).
   - `morning_briefing`: itera por cada `profile` activo del tenant; "entidad" = el usuario; carga sus tareas pendientes + deals abiertos + leads calientes.
   - `weekly_coach`: itera por cada `profile` con rol `tenant_member`/`agent`; analiza `deals` de la semana anterior por `owner_id`.
   - `custom`: usa `config.entity_query` (jsonb con `entity_type` y `filters`) para queries declarativos.
6. Crear `sb` con service-role pero con `tenant_id` clavado en cada insert. Las CRM_TOOLS usan el cliente SR en este contexto (los agentes operan en nombre del sistema, no de un usuario).
7. Para cada entidad (hasta `max_actions_per_run`):
   - Cargar `ai_entity_context` + datos base.
   - Construir `userMessage` con datos serializados de la entidad.
   - Llamar `runAgenticLoop` con `allowedTools` filtrado.
   - Acumular `toolsUsed` en `run_log`.
   - Contar `actions_taken` (cualquier tool != `get_*` y != `search_*`).
   - Para `morning_briefing` y `deal_risk_detector` el output canónico es insertar en `ai_proactive_suggestions` con `priority=10` (briefing) o `8` (risk) → expongo una nueva tool `create_proactive_suggestion(target_user_id, entity_type, entity_id, suggestion_text, action_type, action_payload, priority)` en `CRM_TOOLS`.
   - Si `actions_taken_today + actions_taken >= max_actions_per_run` → break y marcar `status='partial'`.
8. Cerrar el run: `completed_at`, `status`, contadores, `run_log`.
9. Actualizar `ai_agents`: `last_run_at`, `last_run_status`, `actions_taken_today += n`, `next_run_at = computeNext(schedule)`.
10. Robusto a errores: cualquier excepción → `status='failed'`, `error_message`.

**Modelos**:
- Default `google/gemini-2.5-flash` (rápido y barato para batch).
- `weekly_coach` usa `google/gemini-2.5-pro` (override en columna `model`).

**Guardrails**:
- `max_actions_per_run` cortocircuita el loop.
- `runAgenticLoop` recibe `MAX_ITERATIONS=3` por entidad (vs 5 del copiloto).
- WhatsApp: los agentes NO incluyen `prepare_whatsapp_message` ni `send_whatsapp` en `allowedTools`. La regla de oro se mantiene: solo el copiloto con humano al frente puede preparar borradores.

## 4. Datos seed (migración)

Insertar 4 filas en `ai_agents` para cada tenant existente, vía función `seed_default_ai_agents(tenant_id)` y trigger `AFTER INSERT ON tenants`. Para tenants ya creados, INSERT ... SELECT FROM tenants en la migración.

| Agente | type | schedule | tools | max |
|---|---|---|---|---|
| Guardián de Seguimientos | followup_watchdog | `0 9 * * 1-5` | get_pipeline_status, get_contact_context, create_task, create_proactive_suggestion | 20 |
| Detector de Riesgo | deal_risk_detector | `0 18 * * 1-5` | get_pipeline_status, get_contact_context, create_proactive_suggestion | 10 |
| Briefing Matutino | morning_briefing | `30 7 * * 1-5` | get_pipeline_status, search_contacts, get_contact_context, create_proactive_suggestion | 30 |
| Coach Semanal | weekly_coach | `0 8 * * 1` | get_pipeline_status, search_contacts, create_proactive_suggestion | 15 |

Cada uno con `system_prompt` específico en español (objetivo + estilo + restricciones).

## 5. UI mínima de administración

Nueva ruta `/settings/agents` (admin/owner only):
- Lista de `ai_agents` con: nombre, tipo, schedule legible (`cronstrue` mini-helper local en español), toggle `is_active`, `last_run_at`, `last_run_status`, badge "X acciones hoy".
- Botón "Ejecutar ahora" → invoca `ai-agent-runner` directo via `supabase.functions.invoke` (requiere endpoint manual con JWT de admin como alternativa al service-role; se valida `has_role admin`).
- Drawer de detalle: últimos 10 `ai_agent_runs` con `run_log` colapsable.
- No se permite crear agentes custom desde UI en esta iteración (solo toggle + ver). Crear/editar queda para fase posterior.

Link en sidebar `Settings → Agentes IA` con badge `Beta`.

## 6. Integración con widgets existentes

- `Dashboard` ya tiene un placeholder de "Morning Briefing"; conectar a `ai_proactive_suggestions` con `priority>=10` y `target_user_id = auth.uid()` (filtro ya existe). El `briefing_matutino` poblará esa tabla automáticamente.
- El badge de `proactiveCount` en TopBar/Copilot ya cuenta esa tabla → funciona out-of-the-box.

## Detalles técnicos

**Cómo el dispatcher llama al edge**: igual que `notify_ai_context_updater` — `extensions.http_post` con `Authorization: Bearer <service_role_key>` leído de `current_setting('app.settings.service_role_key', true)`. Si el setting no está configurado, el dispatcher loguea warning y no falla (fail-soft).

**Cron parsing en TS**: usar `npm:cron-parser@4` para `computeNext(schedule, { tz: 'America/Mexico_City' })`. Liviano, ya validado en otros proyectos Lovable.

**Tool `create_proactive_suggestion`** (nueva, agregada a `CRM_TOOLS`):
```ts
{ name, description, parameters: {
  target_user_id?: string,  // null = visible a todo el tenant
  entity_type?: string, entity_id?: string,
  suggestion_text: string,
  action_type?: string, action_payload?: object,
  priority: number  // 1-10
}}
```
Inserta en `ai_proactive_suggestions`. Disponible también para el copiloto.

**Reset diario de `actions_taken_today`**: en lugar de cron separado, el runner compara `last_run_at` con `now()` en zona CDMX; si cambió el día, resetea antes de sumar.

**Riesgos**:
- `pg_cron` requiere que `extensions.pg_cron` y `extensions.pg_net`/`extensions.http` estén habilitadas — la migración las habilita.
- Si el service-role no está expuesto vía GUC, el dispatcher no funciona; documentar en notas post-migración cómo el operador setea `ALTER DATABASE postgres SET app.settings.service_role_key = '...'` (ya hay infra similar en este proyecto).
- Costo: 4 agentes × ~30 entidades × tenant puede sumar; `max_actions_per_run` y modelo `flash` mitigan.

## Archivos

**Nuevos**:
- `supabase/migrations/<ts>_ai_agents.sql`
- `supabase/functions/_shared/ai-tools.ts`
- `supabase/functions/ai-agent-runner/index.ts`
- `src/pages/app/settings/AgentsSettings.tsx`
- `src/components/agents/AgentCard.tsx`, `AgentRunsDrawer.tsx`
- `src/services/agents.ts`

**Editados**:
- `supabase/functions/ai-copilot/index.ts` (refactor a usar `_shared/ai-tools.ts`)
- `src/components/layout/Sidebar.tsx` o equivalente (link a `/settings/agents`)
- `src/App.tsx` (ruta nueva)
