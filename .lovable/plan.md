
# Implementación del Copiloto IA con Tool Use

Decisiones confirmadas:
- Provider: **Gemini 2.5 Pro vía Lovable AI Gateway** (sin secrets nuevos).
- Historial persistente en `ai_conversation_history` desde el inicio.
- Incluye las 3 limpiezas pendientes.
- **Sin backfill** de eventos WA históricos — solo nuevos eventos quedan normalizados.

---

## 1. Migración: tabla `ai_conversation_history`

```text
ai_conversation_history
├─ id              uuid pk
├─ tenant_id       uuid (fk tenants)
├─ user_id         uuid (fk auth.users)
├─ conversation_key text         ej. "deal:UUID", "contact:UUID", "global"
├─ role            text          ('user' | 'assistant' | 'tool')
├─ content         jsonb         mensaje completo (incluye tool_calls / tool_results)
├─ created_at      timestamptz default now()
└─ index (tenant_id, user_id, conversation_key, created_at desc)
```

RLS:
- SELECT/INSERT: usuario autenticado donde `user_id = auth.uid()` y `tenant_id = get_user_tenant(auth.uid())`.
- Sin UPDATE/DELETE desde cliente.

## 2. Edge Function nueva: `supabase/functions/ai-copilot/index.ts`

- `verify_jwt = true` (registrado en `supabase/config.toml`).
- Modelo: `google/gemini-2.5-pro` vía AI Gateway (OpenAI-compatible, soporta `tools` y `tool_choice`).
- Define `CRM_TOOLS` (formato OpenAI function calling):
  1. `get_pipeline_status` — KPIs del pipeline activo.
  2. `search_contacts(query, limit)` — busca por nombre/teléfono/email.
  3. `get_contact_context(contact_id)` — lee `ai_entity_context` + últimos eventos.
  4. `create_contact(name, phone, email?, source?)`.
  5. `create_deal(contact_id, title, amount, stage_id?)`.
  6. `move_deal_stage(deal_id, stage_id, reason?)`.
  7. `add_note(entity_type, entity_id, text)`.
  8. `create_task(entity_type, entity_id, title, due_at?)`.
  9. `prepare_whatsapp_message(contact_id, draft)` — **NO envía**, solo retorna preview para confirmación humana.
- `executeTool(name, args, supabaseUserClient)`: switch que ejecuta cada tool con cliente Supabase usando JWT del usuario (respeta RLS).
- **Loop agéntico** (máx 5 iteraciones):
  ```
  while (response.choices[0].finish_reason === 'tool_calls') {
    push assistant tool_calls → messages
    for each tool_call: execute → push tool result → messages
    re-call gateway
  }
  ```
- `buildSystemPrompt(ctx)` inyecta:
  - Rol y nombre del usuario, tenant.
  - Pipeline activo + stages.
  - Hora local `America/Mexico_City`.
  - `ai_entity_context` de la entidad activa (si viene `conversation_key`).
  - Top 3 sugerencias proactivas pendientes.
  - **Regla de oro**: WhatsApp nunca se envía sola; siempre `prepare_whatsapp_message` y esperar confirmación.
- Persistencia: tras cada turno, INSERT en `ai_conversation_history` (mensaje del user, assistant final, y cada tool call/result).
- Manejo errores: 429 → "Rate limit"; 402 → "Sin créditos en Lovable AI"; pasar mensaje claro al cliente.

## 3. Cliente: `src/services/ai.ts`

- Nueva función pública `runCopilot({ message, conversationKey, entityType?, entityId? })`.
- Retorna `CopilotTurn`:
  ```ts
  { text: string;
    toolsUsed: { name: string; args: any; result: any }[];
    pendingWhatsapp?: { contact_id: string; draft: string };
  }
  ```
- `askAi` actual queda intacto (Fase 1 sigue funcionando).

## 4. Limpieza #1 — Database Webhook para `ai-context-updater`

Migración con trigger PG:
```sql
CREATE TRIGGER ai_memory_events_after_insert
AFTER INSERT ON ai_memory_events
FOR EACH ROW EXECUTE FUNCTION net.http_post(
  url := '<edge>/ai-context-updater',
  headers := '{"Authorization":"Bearer <service_role>"}'::jsonb,
  body := jsonb_build_object('entity_type', NEW.entity_type, 'entity_id', NEW.entity_id)
);
```
Con `pg_net`. Si falla la extensión, fallback a `pg_cron` cada minuto procesando entidades con eventos nuevos.

## 5. Limpieza #2 — `logEvent('contact', id, 'note_added', …)`

Editar:
- `src/components/contacts/detail/NotesTab.tsx`: tras `create.mutateAsync`, llamar `aiMemory.logEvent('contact', contactId, 'note_added', { length: t.length })`.
- `src/components/contacts/detail/dialogs/LogActivityDialog.tsx`: para `note`, mismo log; para `call/meeting/email`, log con su `event_type` correspondiente.

## 6. Limpieza #3 — Normalizar `entity_type` de WhatsApp (solo nuevos)

En `supabase/functions/whatsapp-webhook/index.ts` y `whatsapp-send/index.ts`, tras resolver `contact_id` desde la conversación, escribir **dos eventos**:
- `entity_type='conversation'`, `entity_id=conversation_id` (vista de hilo, comportamiento actual).
- `entity_type='contact'`, `entity_id=contact_id` (alimenta contexto del contacto).

Sin backfill; eventos antiguos quedan como están.

## 7. `supabase/config.toml`

Añadir bloque para `ai-copilot` con `verify_jwt = true`. Sin tocar otras funciones.

---

## Lo que NO se toca

- `src/services/aiMemory.ts`, `useAiMemory`, `AiContextPanel`, `MorningBriefing`, `ProactiveBriefing`, `useEntityUrgency` (ya implementados).
- `global-ai`, `ai-execute`, `dashboard-ai-widgets`, etc.
- Esquema de `ai_memory_events` ni `ai_entity_context`.

## Riesgos

- **Latencia**: tool loops pueden tardar 5–10s. Mostrar spinner con texto "Pensando…" / "Ejecutando acción…".
- **RLS en tools**: cliente Supabase dentro del edge function debe usar el JWT del usuario (no service_role) para que las acciones respeten permisos.
- **`pg_net`**: si no está habilitado en el proyecto, el webhook falla silente; verificar en migración con `CREATE EXTENSION IF NOT EXISTS pg_net`.

## Orden de ejecución

1. Migración (tabla historial + trigger pg_net).
2. Edge function `ai-copilot` + `config.toml`.
3. Cliente `runCopilot` en `ai.ts`.
4. Logs en `NotesTab` y `LogActivityDialog`.
5. Doble-evento WA en `whatsapp-webhook` y `whatsapp-send`.

¿Confirmas para arrancar?
