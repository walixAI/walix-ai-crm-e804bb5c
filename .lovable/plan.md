## Objetivo

Convertir la sección de Agentes IA en una experiencia completa para Tenant Admins: lista visual con cards ricas, configuración sin cron raw, historial legible, indicador global en TopBar, y wizard para agentes personalizados (gated por plan).

## Cambios

### 1. Mover Agentes IA a tab dentro de `/settings`

- En `src/pages/app/Settings.tsx`: añadir tab `"agents"` con label `"Agentes IA"` (con badge Beta) entre `Módulos` y `Facturación`.
- Crear `src/components/settings/agents/AgentsTab.tsx` (refactor del actual `AgentsSettings.tsx`) que recibe `tenantId`.
- Mantener la ruta `/settings/agents` redirigiendo a `/settings` con `?tab=agents` (compat) — actualizar `Sidebar.tsx` para apuntar al tab.
- Eliminar `src/pages/app/settings/AgentsSettings.tsx` y su import en `App.tsx`.

### 2. Lista de agentes — `AgentsTab.tsx`

Header con resumen calculado client-side:
- `X agentes activos · Última ejecución hace Y · Z acciones hoy` (suma de `actions_taken_today`, min `now - max(last_run_at)`).

Cada `AgentCard` (`src/components/settings/agents/AgentCard.tsx`):
- Ícono por `agent_type` (mapa: followup_watchdog→ShieldAlert, deal_risk_detector→TrendingDown, morning_briefing→Sunrise, weekly_coach→GraduationCap, lead_qualifier→UserCheck, custom→Sparkles).
- Nombre + descripción + Switch ON/OFF.
- "Próxima ejecución" derivada de `schedule` con `cronstrue`-like helper local (extender `describeCron` con `nextRunFromCron(schedule)` usando una mini util).
- "Última ejecución: hace Xh · N acciones" usando `date-fns/formatDistanceToNow`.
- Status badge: `Activo` / `Ejecutando` (spinner cuando hay run con `status="running"`) / `Error` / `Pausado`.
- Tres botones: `Ejecutar ahora` (existente), `Configurar` (abre modal nuevo), `Ver historial` (expande inline accordion en lugar de Sheet).

### 3. Modal de configuración — `AgentConfigDialog.tsx`

Dialog con form (react-hook-form + zod):
- Nombre, Descripción.
- **Schedule sin cron raw**: RadioGroup `Diario / Dos veces al día / Solo días hábiles / Solo lunes` + `<Input type="time">`. Helper `buildCron(preset, time) → string` y `parseCron(string) → {preset, time}`. Preview legible debajo.
- Slider `max_actions_per_run` (1–50).
- Sección condicional por `agent_type`, persiste en `config jsonb`:
  - `followup_watchdog`: `inactive_days` (input number, default 5).
  - `deal_risk_detector`: `min_urgency_score` (slider 0–100, default 60).
  - `morning_briefing`: checkboxes `include_deals / include_contacts / include_tasks / include_metrics`.
- `Guardar`: `update ai_agents set name, description, schedule, max_actions_per_run, config`. Recalcular `next_run_at` server-side via función `ai_recompute_next_run(agent_id)` (migration nueva, SECURITY DEFINER, usa cron parser simple) — invocada con `supabase.rpc`.

### 4. Historial expandible — `AgentRunsList.tsx`

Reemplazar el `Sheet` actual por accordion inline dentro de la card.
- Tabla compacta: Fecha · Duración (`completed_at - started_at`) · Entidades · Acciones · Status.
- Click en fila → expande `run_log` formateado: cada item `{ts, message}` se renderiza como `HH:MM — message` (no JSON crudo). Ya el runner debería estar logueando entradas estructuradas; añadir helper `formatLogEntry(entry)` que tolera strings y objetos legacy.

### 5. Indicador global en TopBar

- Nuevo componente `src/components/agents/AgentsActivityIndicator.tsx`:
  - Suscripción Supabase Realtime a `ai_agent_runs` (filtrado por tenant via RLS) + fallback `setInterval` 30s.
  - Cuenta runs con `status="running"`. Si >0, muestra ícono `Bot` con badge numérico y tooltip con nombre del agente activo.
  - Click → `navigate("/settings?tab=agents")`.
- Insertarlo en `TopBar.tsx` justo a la izquierda del AiPromptBar (antes de `<div className="flex-1 max-w-2xl">`).
- Habilitar realtime en migration: `ALTER PUBLICATION supabase_realtime ADD TABLE ai_agent_runs;` y `REPLICA IDENTITY FULL`.

### 6. Wizard de agente personalizado

`src/components/settings/agents/CustomAgentWizard.tsx` con `Dialog` multi-step (5 pasos):
1. Nombre + objetivo (textarea).
2. Scope de datos: checkboxes (`pipeline / contacts / whatsapp / reports`) — controla qué `allowed_tools` se incluyen.
3. Acciones: radio `Solo sugerir` / `Sugerir + crear tareas` / `Sugerir + crear tareas + mover deals` — mapea a subset de tools.
4. Schedule (mismo selector visual del modal de config).
5. Preview del `system_prompt` autogenerado a partir de objetivo + scope + acciones, **editable**.

Botón `+ Crear agente personalizado`:
- Plan PyME → botón con `<Lock>`, abre `<UpgradeDialog>` (reusar patrón existente o un toast con CTA si no hay).
- Plan Growth/Enterprise → abre wizard. Detección via `tenants.plan` (query existente `useTenantPlan` o similar; verificar y si no existe, crear hook simple).
- Submit → `insert ai_agents` con `agent_type='custom'`, `tenant_id`, `system_prompt` editado, `allowed_tools` calculados.

### 7. Backend mínimo

Migration nueva:
- Función `ai_recompute_next_run(p_agent_id uuid)` SECURITY DEFINER: parsea `schedule` (soportar los presets generados) y setea `next_run_at`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE ai_agent_runs;` + `REPLICA IDENTITY FULL`.
- Permitir UPDATE en `ai_agents` (ya existe policy admin update — confirmar que cubre `config`, `schedule`, `name`, `description`, `max_actions_per_run`).

`runner` actual: ajustar para que respete `config` por tipo:
- `followup_watchdog`: usar `config.inactive_days`.
- `deal_risk_detector`: usar `config.min_urgency_score`.
- `morning_briefing`: pasar flags al prompt.

### 8. Archivos

**Nuevos**
- `src/components/settings/agents/AgentsTab.tsx`
- `src/components/settings/agents/AgentCard.tsx`
- `src/components/settings/agents/AgentConfigDialog.tsx`
- `src/components/settings/agents/AgentRunsList.tsx`
- `src/components/settings/agents/CustomAgentWizard.tsx`
- `src/components/settings/agents/scheduleHelpers.ts` (buildCron / parseCron / nextRun / describe)
- `src/components/agents/AgentsActivityIndicator.tsx`
- `supabase/migrations/<timestamp>_agents_ui.sql`

**Editados**
- `src/pages/app/Settings.tsx` (tab nuevo)
- `src/components/layout/Sidebar.tsx` (link → `/settings?tab=agents`)
- `src/components/layout/TopBar.tsx` (indicador)
- `src/App.tsx` (quitar ruta `/settings/agents` o redirigir)
- `src/services/agents.ts` (añadir `updateAgent`, `createCustomAgent`, `getRunningAgents`, `recomputeNextRun`)
- `supabase/functions/ai-agent-runner/index.ts` (leer `config`)

**Eliminados**
- `src/pages/app/settings/AgentsSettings.tsx`

## Riesgos

- Realtime en `ai_agent_runs` necesita que `pg_cron` dispare runs reales para que el indicador se vea; ya está scheduled cada 5 min.
- Parsear cron arbitrario es complejo; sólo soportamos los presets del UI (cualquier cron custom externo cae en `describeCron` raw fallback).
- Plan gating: si no existe hook de plan, lo creo simple leyendo `tenants.plan`.
