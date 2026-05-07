# Mejoras post-9 prompts: timezone, métricas IA, backfill Aprendiz, A/B drafts

Cuatro mejoras independientes que se pueden ejecutar en una sola pasada. Ninguna toca el flujo crítico de los 9 prompts ya entregados.

## 1. Timezone real por usuario

Hoy `deliverNotification` y los cálculos de "mejor hora/día" del Aprendiz asumen `America/Mexico_City`. Solución:

- **Migración**: añadir `profiles.timezone text NOT NULL DEFAULT 'America/Mexico_City'`.
- **UI**: en `MyAIProfileTab.tsx` (o `Settings → General → Mi cuenta`), un `Select` con zonas comunes de LATAM + buscador (`Intl.supportedValuesOf("timeZone")`).
- **Helper `_shared/notifications.ts`**: aceptar `timezone` opcional; si no se pasa, leerlo de `profiles.timezone` del `userId`. `isWithinWorkHours` y `nextDigest9amCDMX` reciben el TZ por parámetro.
- **`ai-agent-runner` (rama Aprendiz)**: al calcular `best_close_day/hour`, usar el TZ del owner del deal.

## 2. Tablero de métricas IA en `/admin` (Platform)

Para Platform Owner / Staff. Nueva pestaña en `Platform.tsx` o ruta `/admin/ai-metrics`:

- **KPIs globales (últimos 7 / 30 días)**:
  - Runs de agentes ejecutados, tasa de éxito (`status='completed'`), tasa de error.
  - Sugerencias creadas vs. accionadas (`acted_on=true`).
  - Tokens consumidos por tenant (requiere registro previo — ver siguiente bullet).
  - Top 5 tenants por uso del Copiloto (count de `ai_conversation_history`).
- **Captura de tokens**: `runAgenticLoop` ya recibe la respuesta del gateway → extender para devolver `usage.total_tokens` y persistir en una nueva tabla `ai_usage_log (tenant_id, surface, model, input_tokens, output_tokens, created_at)`.
- **Componente**: `src/pages/app/admin/AIMetrics.tsx` con `Card` de KPIs + tabla `usePlatformAIUsage`.
- **RLS**: `ai_usage_log` solo lectura para `is_platform(auth.uid())`; insert por service role.

## 3. Backfill histórico del Aprendiz

Para que tenants nuevos no esperen una semana antes de ver patrones.

- **Edge function `aprendiz-backfill`** (manual / one-shot por tenant):
  - Input: `{ tenant_id, days?: number }` (default 90).
  - Reusa la lógica de `updateUserProfilesFromData` y agregadores de `ai_outcome_feedback` que ya existen en la rama `aprendiz` de `ai-agent-runner`, pero con ventana extendida.
  - Llama a `update_tenant_pattern` y `update_user_profile_insights` igual que el agente.
- **Botón en `AgentsTab`** (solo para `agent_type='aprendiz'`): "Procesar histórico (90 días)" — solo visible para tenant_admin/owner, con `confirm` y rate limit (máximo 1 vez al día por tenant, con flag en `ai_agents.config.last_backfill_at`).

## 4. A/B de borradores (analytics del Copiloto)

Cuantificar el valor de los drafts del Copiloto comparando tasa de respuesta entre mensajes editados vs. no editados.

- **Marcado en `ai_draft_edits`** ya está; añadir columna **`message_id uuid`** a `ai_draft_edits` para enlazar el draft con el mensaje real enviado (capturar al insertar en `messages` desde `confirmWhatsapp`).
- **Vista `v_ai_draft_ab`** (SQL view o tabla materializada semanal):
  - Por mensaje del Copiloto: `was_edited`, `char_delta`, `got_reply` (existe inbound posterior dentro de 48h en la misma `conversation`), `reply_within_hours`.
- **Widget en `Reports.tsx`**: card "Impacto del Copiloto" con:
  - Tasa de respuesta — drafts originales vs. editados.
  - Tiempo promedio a respuesta.
  - Volumen analizado + badge confianza (>50 mensajes = alta).

## Archivos

**Nuevos:**
- `supabase/migrations/<ts>_timezone_and_ai_usage.sql` (profiles.timezone + ai_usage_log + ai_draft_edits.message_id + view v_ai_draft_ab)
- `supabase/functions/aprendiz-backfill/index.ts`
- `src/pages/app/admin/AIMetrics.tsx`
- `src/lib/queries/platformAI.ts`
- `src/components/reports/CopilotImpactCard.tsx`

**Editados:**
- `supabase/functions/_shared/notifications.ts` (TZ por parámetro / lookup)
- `supabase/functions/_shared/ai-tools.ts` (`runAgenticLoop` registra `ai_usage_log`)
- `supabase/functions/ai-agent-runner/index.ts` (Aprendiz usa TZ del owner)
- `src/components/settings/me/MyAIProfileTab.tsx` (selector timezone)
- `src/components/settings/agents/AgentsTab.tsx` o `AgentCard.tsx` (botón backfill en Aprendiz)
- `src/store/copilot.ts` (capturar `message_id` en `logDraftEdit`)
- `src/pages/app/Reports.tsx` (montar `CopilotImpactCard`)
- `src/pages/app/Platform.tsx` (link a `/admin/ai-metrics`)

## Riesgos

- `Intl.supportedValuesOf` no existe en Safari < 17 — fallback a lista hardcodeada de ~10 zonas LATAM.
- Backfill puede ser pesado: limitar a 90 días y usar `LIMIT 5000` en queries internas.
- `ai_usage_log` puede crecer rápido — incluir en la limpieza semanal (`>180 días`).
- La heurística de "got_reply" necesita que `messages.direction='inbound'` esté correctamente seteado para WhatsApp; si no, la métrica subreporta.
