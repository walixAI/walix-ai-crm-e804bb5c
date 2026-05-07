# Personalización individual del Copiloto (capa "Mi Perfil IA")

Añade una capa de aprendizaje y configuración por usuario. El copiloto conoce el estilo, horarios y preferencias de cada vendedor y adapta sus respuestas y borradores WhatsApp.

## 1. Base de datos (migración)

**Nueva tabla `ai_user_profile`** (PK `user_id`, FK lógico a `auth.users`, NO foreign key real — por instrucciones Supabase):

| Columna | Tipo | Default |
|---|---|---|
| `user_id` | uuid PK | — |
| `tenant_id` | uuid NOT NULL | — |
| `communication_style` | text | `'formal'` (`formal` / `casual` / `muy_casual`) |
| `preferred_message_length` | text | `'medium'` |
| `best_close_day` | text | null |
| `best_close_hour` | int | null |
| `avg_response_time_hours` | float | null |
| `top_performing_stage` | text | null |
| `close_rate` | float | 0 |
| `total_deals_closed` | int | 0 |
| `total_deals_lost` | int | 0 |
| `strengths` | text[] | `{}` |
| `improvement_areas` | text[] | `{}` |
| `custom_instructions` | text | `''` |
| `notify_only_work_hours` | bool | false |
| `notify_digest_9am` | bool | false |
| `allow_auto_tasks` | bool | true |
| `weekly_coaching_report` | bool | true |
| `created_at` / `updated_at` | timestamptz | now() |

**RLS:**
- `select` / `insert` / `update`: el propio usuario (`user_id = auth.uid()`) o admin/owner del tenant.
- Service role para Aprendiz.

**Nueva tabla `ai_draft_edits`** (para aprendizaje de estilo):
`id, tenant_id, user_id, original text, edited text, char_delta int, contact_id uuid null, created_at`. RLS: insert/select propio usuario.

**Trigger / función `seed_ai_user_profile()`**: crea fila vacía cuando un profile nuevo se inserta. Backfill insert para usuarios existentes.

## 2. Servicio frontend

`src/services/userProfile.ts`:
- `getMyAIProfile()`
- `updateMyAIProfile(patch)`
- `logDraftEdit({ original, edited, contactId? })`

## 3. UI en Settings — nueva tab "Mi Perfil IA"

Añadir tab `me` en `src/pages/app/Settings.tsx` (visible para todos, no solo admin).

Componente `src/components/settings/me/MyAIProfileTab.tsx` con 3 secciones:

**Sección 1 — "Cómo me conoce el copiloto"** (read-only, datos del perfil):
- Badge estilo de comunicación detectado
- Longitud preferida
- Horas de actividad
- Tasa de cierre vs promedio del equipo (calculado contra `deals` del tenant)
- Chips de fortalezas / áreas de mejora
- Footer: "Basado en el análisis de tus últimos N deals" + estado vacío "Recopilando datos…" si <10 deals

**Sección 2 — "Instrucciones personales para el copiloto"**:
- `Textarea` con `custom_instructions` (placeholder con ejemplo)
- Botón "Guardar mis instrucciones"

**Sección 3 — "Notificaciones inteligentes"**:
- 4 toggles → `notify_only_work_hours`, `notify_digest_9am`, `allow_auto_tasks`, `weekly_coaching_report`

## 4. Inyección en system prompt

En `supabase/functions/ai-copilot/index.ts`:
- Cargar perfil del usuario activo (`ai_user_profile` por `userId`).
- Tras `appendLearnedPatterns`, añadir bloque:
  ```
  PERFIL DEL VENDEDOR ACTIVO:
  - Estilo de comunicación: {style}
  - Longitud preferida: {length}
  - Tasa de cierre personal: {close_rate}%
  - Mejor día / hora: ...
  - Instrucciones personales: {custom_instructions}
  Ajusta el tono y estilo de tus respuestas y borradores a este perfil.
  ```
- Helper compartido `appendUserProfile(systemPrompt, profile)` en `supabase/functions/_shared/ai-tools.ts` para reutilizar también en `ai-agent-runner` cuando el agente actúe en nombre de un vendedor concreto (Briefing Matutino, Coach Semanal).

## 5. Aprendizaje de estilo desde drafts editados

**Frontend (`src/store/copilot.ts` `confirmWhatsapp`)**: comparar `draft` final con `msg.pendingWhatsapp.draft` original; si difieren llamar `logDraftEdit({ original, edited, contactId })`.

**Aprendiz (`ai-agent-runner.ts` rama `aprendiz`)**: además del análisis actual, agregar paso:
- Para cada usuario del tenant con ≥10 entradas en `ai_draft_edits` última semana:
  - Calcular promedio `char_delta`, longitud promedio editada → derivar `preferred_message_length` (`<120` short, `<300` medium, else long).
  - Heurística simple para `communication_style` (presencia de "tú/tutear" vs "usted", emojis, signos !).
  - Calcular `close_rate`, `total_deals_closed/lost`, `best_close_day/hour`, `top_performing_stage` desde `deals`/`deal_stage_history`.
  - `update` upsert sobre `ai_user_profile` vía service-role.
- Las `strengths` / `improvement_areas` las propone el LLM; nueva tool `update_user_profile_insights(user_id, strengths[], improvement_areas[])` añadida a `CRM_TOOLS` y autorizada solo para el agente `aprendiz`.

## 6. Notificaciones inteligentes (consumo de toggles)

- En `notification-dispatcher` o donde se inserten `notifications` para un user, respetar `notify_only_work_hours` (hora local CDMX 8–19) y `notify_digest_9am` (encolar para batch). Por ahora añadir helper `shouldDeliverNotificationNow(userId)` y aplicarlo en los puntos existentes que insertan notificaciones dirigidas (búsqueda y wiring); si alguno falta, queda como TODO con log claro.
- `allow_auto_tasks` lo lee `ai-agent-runner` antes de invocar `create_task` para ese usuario.
- `weekly_coaching_report`: el agente Coach Semanal salta usuarios con `false`.

## 7. Archivos

**Nuevos:**
- `supabase/migrations/<ts>_ai_user_profile.sql`
- `src/services/userProfile.ts`
- `src/components/settings/me/MyAIProfileTab.tsx`
- `src/components/settings/me/AIProfileInsights.tsx`
- `src/components/settings/me/PersonalInstructions.tsx`
- `src/components/settings/me/SmartNotifications.tsx`

**Editados:**
- `src/pages/app/Settings.tsx` (añadir tab `me` "Mi Perfil IA")
- `src/store/copilot.ts` (log de edición de draft)
- `supabase/functions/_shared/ai-tools.ts` (helpers `getUserProfile`, `appendUserProfile`, tool `update_user_profile_insights`)
- `supabase/functions/ai-copilot/index.ts` (inyectar perfil)
- `supabase/functions/ai-agent-runner/index.ts` (rama aprendiz extendida + respeto a toggles)

## Riesgos

- Heurística de `communication_style` es naive — está bien como semilla; el LLM la refina.
- Asegurar que `update_user_profile_insights` solo escribe perfiles del mismo tenant (validación server-side).
- `ai_draft_edits` puede crecer rápido — sin índice extra por ahora; cleanup futuro.
