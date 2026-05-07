# Cierre de pendientes — 9 prompts del día

Tras re-auditar el código, varios pendientes que figuraban antes ya están implementados (cron de agentes, gating del wizard por plan, validación tenant en `update_user_profile_insights`, índice en `ai_draft_edits`, estado vacío del widget de insights). Este plan ataca solo lo que realmente queda abierto.

## 1. Notificaciones inteligentes (toggles del Perfil IA)

Hoy los toggles `notify_only_work_hours`, `notify_digest_9am` y `weekly_coaching_report` se persisten pero **ningún código los respeta** porque no existe un punto central que inserte notificaciones (no se encontraron inserts a `notifications` en edge functions).

Acciones:

- **Helper compartido** `supabase/functions/_shared/notifications.ts`:
  - `deliverNotification(sb, { userId, tenantId, type, title, body, payload })`
  - Lee `ai_user_profile` del usuario.
  - Si `notify_only_work_hours = true` y la hora local CDMX no está en 8–19 lun–vie → guarda en `notifications_queue` (tabla nueva) en vez de `notifications`.
  - Si `notify_digest_9am = true` → siempre encola hasta el digest.
  - En caso normal → insert directo en `notifications`.
- **Tabla `notifications_queue`** (migración):
  - `id, tenant_id, user_id, payload jsonb, deliver_after timestamptz, created_at`
  - RLS: usuario propio + service role.
- **Edge function `notifications-digest`** (nueva):
  - Drena `notifications_queue` con `deliver_after <= now()`.
  - Agrupa por usuario y hace 1 insert resumen en `notifications` (título "Resumen del día (N novedades)").
- **Cron `pg_cron`**: cada 15 min llama a `notifications-digest` (anon key).
- **Cableado**: usar `deliverNotification(...)` desde `ai-agent-runner` cuando crea sugerencias proactivas dirigidas a un user (Briefing Matutino, Coach Semanal, Detector de Riesgo).

## 2. Modo voz del AiPromptBar (prompt 5)

Confirmar/implementar el dictado por voz del copiloto:

- En `AiPromptBar`, botón micrófono usa `webkitSpeechRecognition` (Web Speech API) con `lang="es-MX"`, `continuous=false`, `interimResults=true`.
- Estado visual: pulso rojo mientras escucha, transcripción en vivo en el input, auto-stop al detectar silencio (~1.5s).
- Fallback: si la API no existe en el navegador, deshabilitar el botón con tooltip "Tu navegador no soporta dictado".

## 3. Hardening / limpieza

- **Tests Deno** mínimos en `supabase/functions/_shared/`:
  - `ai-tools_test.ts`: `appendUserProfile`, `appendLearnedPatterns`, `update_user_profile_insights` (rechaza usuario fuera de tenant).
- **Job de retención** (`pg_cron` semanal):
  - `delete from ai_draft_edits where created_at < now() - interval '90 days'`
  - `delete from ai_outcome_feedback where created_at < now() - interval '180 days'`
  - `delete from notifications_queue where deliver_after < now() - interval '7 days'`

## Archivos

**Nuevos:**
- `supabase/functions/_shared/notifications.ts`
- `supabase/functions/notifications-digest/index.ts`
- `supabase/functions/_shared/ai-tools_test.ts`
- `supabase/migrations/<ts>_notifications_queue_and_retention.sql` (tabla + cron digest + cron retención)

**Editados:**
- `supabase/functions/ai-agent-runner/index.ts` (usar `deliverNotification` y respetar `weekly_coaching_report` ya estaba; ampliar a Briefing/Detector)
- `src/components/copilot/AiPromptBar.tsx` (modo voz)

## Riesgos

- `notifications_queue` requiere que sepamos el timezone del usuario. Por ahora se asume CDMX (`America/Mexico_City`); más adelante leer de `profiles.timezone` si existe.
- Web Speech API no funciona en Safari iOS bien — se acepta degradación.
- El cron de digest cada 15 min puede generar latencia hasta 15 min en notificaciones encoladas; es aceptable para un digest 9am.

## Fuera de alcance (descartados como no-pendiente)

- Cron de `ai_run_due_agents`: ya existe.
- Gating Growth/Enterprise del wizard: ya existe.
- Validación tenant en `update_user_profile_insights`: ya existe.
- Índice en `ai_draft_edits`: ya existe.
- Estado vacío del widget de insights: ya renderiza.
