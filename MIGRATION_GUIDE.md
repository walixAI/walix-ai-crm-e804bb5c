
# Walix.ai — Documento de arquitectura y funcionalidades para migración

Guía de referencia para migrar Walix.ai por etapas hacia una base "AI-first" en Claude Code. Cubre stack, modelo de datos, edge functions, frontend, capacidades del Copiloto y un plan de migración incremental.

---

## 1. Stack y topología

**Frontend**
- React 18 + Vite 5 + TypeScript 5
- Tailwind v3 + shadcn/ui + tokens semánticos en `src/index.css`
- TanStack Query (fetching/cache), Zustand (`src/store/*`), React Router
- dnd-kit (drag & drop), lucide-react, react-phone-number-input

**Backend (Lovable Cloud = Supabase gestionado)**
- Postgres con RLS estricta multi-tenant
- Supabase Auth (email + Google), invitaciones custom
- Storage: bucket `tenant-assets`
- Edge Functions Deno (`supabase/functions/*`)
- pg_cron + pgmq (colas de email, agentes IA, gastos recurrentes)
- Vault para secretos de servicio

**IA**
- Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1`), header `Lovable-API-Key`
- Modelo por defecto: `google/gemini-2.5-flash` (razonamiento: `gemini-2.5-pro`)
- AI SDK (`ai`) con `streamText`, `generateText`, `tool()`, `Output.object`

**Integraciones externas**
- Meta WhatsApp Cloud API (webhook, envío, BYO-WABA embedded signup)
- Resend (transaccional vía cola pgmq)

---

## 2. Modelo multi-tenant

Jerarquía: `organizations → tenants → profiles/users`.

- **organizations**: agrupa varios `tenants` (multi-empresa por cuenta), tiene `plan` y `org_owner`.
- **tenants**: unidad de negocio real (branding, plan, trial, módulos activos, `active_tenant_id` en profile).
- **profiles**: 1:1 con `auth.users`, guarda `tenant_id`, `active_tenant_id`, `ui_prefs` (mode `simple|advanced`, layouts).
- **user_roles**: roles por usuario, opcionalmente scoped a `tenant_id`. Función `has_role(uid, role)` SECURITY DEFINER.
- **organization_members**: membresía + rol org (`org_owner` / `org_member`).
- **invitations**: token, expira, `accept_invitation(token)` RPC.

Roles (`src/constants/permissions.ts`):
`platform_owner`, `platform_staff`, `org_owner`, `org_member`, `tenant_owner`, `tenant_admin`, `sales_manager`, `sales_rep` (+ legacy `super_admin`).

RLS pattern:
- Todas las tablas de negocio filtran por `tenant_id = get_user_tenant(auth.uid())`.
- Escrituras admin requieren `has_role(auth.uid(), 'tenant_admin'|'tenant_owner')`.
- Plataforma bypasea vía `is_platform(uid)`.

---

## 3. Módulos funcionales

### 3.1 Contactos
- Tablas: `contacts`, `companies`, `contact_stages`, `contact_sources`, `contact_tags`.
- Kanban por stage, list, import CSV, bulk actions, reasignación.
- Modo "simple" (`ContactDetailSimple`) para tercera edad: tareas centradas, historial colapsado, guía contextual.
- Sólo el nombre es obligatorio (memoria de proyecto).

### 3.2 Pipeline / Oportunidades (tabla interna: `deals`)
- Terminología UI: **Oportunidad** (memoria de proyecto). Nombres técnicos/tools conservan `deal_id`.
- Tablas: `pipelines`, `pipeline_stages`, `deals`, `deal_stage_history`, `product_categories`.
- Kanban + list view, forecast KPIs, health badges, filtros persistidos.
- Lost reason dialog, quick tasks, bulk actions, AI insights panel.
- Probabilidad: manual → `pipeline-ai` → fallback visual (`src/services/ai.ts`).

### 3.3 WhatsApp
- Tablas: `whatsapp_channels`, `conversations`, `messages`, `whatsapp_user_access` (vendedores autorizados), `message_templates`, `whatsapp_webhook_log`, `whatsapp_command_log`.
- Edge functions: `whatsapp-webhook` (routing vendedor vs cliente, priority=vendor con auto-fallback), `whatsapp-send` (con `sent_by_user_id`), `whatsapp-verify`, `whatsapp-ai`, `whatsapp-ai-command`, `whatsapp-embedded-signup`, `whatsapp-embedded-config`, `whatsapp-discover-waba`, `whatsapp-connect-discovered`, `whatsapp-team-invite`.
- Normalización E.164 en `_shared/phone.ts` y `src/lib/phone.ts` (fix legacy "1" MX).
- BYO-WABA wizard: descubrimiento + conexión.

### 3.4 Tareas y Mi Día
- Tabla `tasks` + `activities` (evidencia).
- **Mi Día**: 6 chips KPI en una fila (Tareas hoy, Por cobrar, Por cotizar, Servicios hoy, Seguimientos, Run Rate resumido, Rentabilidad resumida, Ventas ganadas).
- Cierre inteligente: requiere evidencia (WhatsApp/Call/Note) — `src/lib/tasks/closure.ts` + `autoClose.ts`.
- Reagendado "Seguir cobrando" con sugerencia día/hora.
- Diálogos: `CloseTaskDialog`, `RegisterPaymentDialog`, `RescheduleCollectionDialog`, `QuickTaskDialog`.

### 3.5 Metas mensuales multi-dimensión
- Tablas: `tenant_monthly_goals` (legacy global), `monthly_goals` (dimensión: `global|deal_type|pipeline|product_category`), `monthly_goal_assignments` (split % por usuario), `monthly_goal_history`.
- Trigger `monthly_goals_no_past` bloquea edición de meses cerrados.
- RPC `suggest_goal_split` (histórico últimos 3 meses), `get_user_run_rate`, `get_user_profitability`.

### 3.6 Gastos
- Tablas: `expenses`, `expense_categories`, `expense_rules` (% del deal / fijo / % del costo), `recurring_expenses`.
- Seed por tenant (renta, nómina, viáticos…).
- Trigger `generate_deal_expense_drafts` al marcar `is_won`.
- Cron `generate_recurring_expenses` mensual.
- Estados `draft|confirmed`, panel de aprobación.

### 3.7 Reportes
- Página `/reports`: KPI hero, embudo, conversiones por etapa, heatmap actividad, ranking vendedores, deals perdidos, pie fuentes.
- Export CSV/PDF (`src/lib/reports/`).
- Team dashboard `/equipo` con Run Rate y margen por usuario.

### 3.8 Automatizaciones
- Tablas: `automations`, `automation_runs`.
- Builder sheet, dry-run, plantillas, IA-draft, historial.
- Registry `src/lib/automations/registry.ts`.

### 3.9 Marketplace / Módulos
- Tabla `tenant_modules`, catálogo estático `src/lib/marketplace/catalog.ts`.
- Activación por tenant, límites por plan (`plan_limits`, `org_plan_limits`).

### 3.10 Notificaciones
- `notifications`, `notifications_queue` (in-app), `email_send_log`, `suppressed_emails`.
- Bell en TopBar, digest edge function.

### 3.11 Auditoría
- `audit_log`, `monthly_goal_history`, `deal_stage_history`.

---

## 4. Sistema IA (núcleo "AI-first")

### 4.1 Copiloto conversacional (`ai-copilot`)
- System prompt inyecta contexto de tenant (nombre, industria, metas, RunRate, plan).
- **Guardrail estricto**: sólo negocio del tenant + funcionalidades Walix; rechaza off-topic.
- Historia en `ai_conversation_history` con `conversation_key` derivado de ruta+entidad.
- Store cliente: `src/store/copilot.ts`, drawer `CopilotDrawer`.

### 4.2 Tools nativas del Copiloto
Lectura: `get_pipeline_status`, `search_contacts`, `get_contact_context`, `get_my_tasks`, `get_my_suggestions`, `get_my_deals` (scope `mine|tenant`), `get_profitability`, `get_run_rate`, `get_expenses_summary`, `get_monthly_goal`, `get_team_performance`.
Ejecución: `create_task`, `create_proactive_suggestion`, `create_contact`, `move_deal_stage`, `set_monthly_goal` (con confirmación obligatoria), `update_tenant_pattern`, `update_user_profile_insights`.

### 4.3 Capacidades configurables (Walix Builder)
- Tablas: `copilot_capabilities` (recipes JSON), `copilot_action_log`.
- Admin activa/desactiva primitivas por rol/usuario/canal (web|whatsapp), con confirmación opcional.
- Edge function `copilot-builder` entrevista al admin y genera recipe combinando primitivas del catálogo seguro.
- UI: `Settings → Copiloto` (`CopilotCapabilitiesTab`, `NewCapabilityWizard`).

### 4.4 Agentes autónomos (`ai_agents`, `ai_agent_runs`)
Seeds por tenant:
- Guardián de Seguimientos (9:00 L-V)
- Detector de Riesgo (18:00 L-V)
- Briefing Matutino (7:30 L-V)
- Coach Semanal (Lun 8:00, pro)
- Aprendiz (Dom 3:00, aprende patrones)

Orquestación: `ai_run_due_agents()` (cron) → dispatch a `ai-agent-runner` edge function con `net.http_post`. Recompute cron con `ai_recompute_next_run`.

### 4.5 Memoria y aprendizaje
- `ai_entity_context`: último snapshot por entidad, actualizado por `ai-context-updater` (trigger vía `net.http_post`).
- `ai_memory_events`: eventos crudos.
- `ai_proactive_suggestions`: sugerencias por usuario/entidad, con `acted_on`.
- `ai_outcome_feedback`: cierra el loop (deal ganado/perdido, respuesta WhatsApp) atribuido a sugerencia reciente (`recent_acted_suggestion`).
- `ai_user_profile`, `ai_tenant_patterns`: fortalezas/insights aprendidos.
- `ai_draft_edits`, `ai_feedback`, `ai_suggestions`, `ai_usage_log`.

### 4.6 Otras edge functions IA
`dashboard-ai-widgets`, `pipeline-ai`, `pipeline-suggest`, `contact-ai-suggest`, `contacts-ai-create`, `automations-ai-draft`, `ai-inbox`, `ai-execute` (con test), `ai-onboarding-setup`, `onboarding-seed`, `aprendiz-backfill`, `global-ai`, `notifications-digest`.

---

## 5. Frontend: rutas y layout

Layout: `src/components/layout/AppLayout.tsx` (Sidebar + TopBar + BottomNav móvil + CopilotDrawer + CommandPalette Ctrl+K/J + OnboardingTour + TrialBanner).

Rutas protegidas (`ProtectedRoute` con `requireRoles`):
- `/dashboard` — KPIs, AI section, layout configurable
- `/mi-dia` — modo operativo diario (simple mode)
- `/contacts`, `/contacts/:id` (advanced), simple detail para modo fácil
- `/pipeline` — Kanban + list
- `/whatsapp` — inbox interno (no wa.me)
- `/wa-sim` — simulador
- `/reports` — reportes + export
- `/gastos` — expenses
- `/automations`
- `/equipo` — team dashboard (admin)
- `/marketplace`
- `/settings` — tabs: General, Branding, Pipeline, WhatsApp, Team, Módulos, Copiloto, Metas, Gastos, Actividad, Mi Perfil IA, **Tarjetas** (layout)
- `/admin`, `/admin/ai-metrics` — tenant admin
- `/org` — org owner
- `/platform` — Walix staff/owner

Home dinámico: `RootRedirect` → `/mi-dia` (simple) o `/dashboard` (advanced) según `ui_prefs.mode`.

---

## 6. Sistema de widgets configurable (Fase 1 implementada)

- `dashboard_widgets` (catálogo, `tenant_id` NULL = global nativo).
- `dashboard_layouts` (scope `tenant_default|role:x|user:uid`, `items` jsonb).
- Cascada: `user override → role → tenant_default → catálogo`.
- Hook: `src/lib/queries/dashboardLayout.ts`.
- Renderer: `LayoutRenderer` + registry native_key → componente.
- UI: `CustomizeSheet` (dnd-kit) + `WidgetsTab` en Settings.
- Roadmap: Fase 2 wizard "custom_metric", Fase 3 builder conversacional.

---

## 7. Convenciones y guardrails

- Tokens semánticos (nunca `text-white`, `bg-[#...]`).
- Terminología UI: "Oportunidad" para `deals`.
- Toda tabla `public` requiere `GRANT` explícito + RLS + policies.
- Secretos server-side: `LOVABLE_API_KEY`, `META_*`, `SUPABASE_*`.
- Client Supabase auto-generado en `src/integrations/supabase/{client,types}.ts` — no editar.

---

## 8. Plan de migración por etapas a Claude Code

Asumiendo que tu base "AI-first" ya tiene: shell de app, auth, un patrón de tools/agents, y stack similar (React/TS/Postgres). Ajusta si difiere.

### Etapa 0 — Preparación (1-2 días)
- Congelar snapshot del schema actual (`pg_dump --schema-only`).
- Exportar seeds de catálogos (`contact_stages`, `contact_sources`, `expense_categories`, `dashboard_widgets` global, `copilot_capabilities` template).
- Inventariar edge functions y clasificar (críticas / auxiliares / IA).
- Mapear roles de tu base AI-first ↔ roles Walix.
- Definir estrategia de tenancy en la base destino.

### Etapa 1 — Fundación multi-tenant
Migrar: `organizations`, `tenants`, `profiles`, `user_roles`, `organization_members`, `invitations` + funciones `has_role`, `get_user_tenant`, `is_platform`, `is_org_member`, `accept_invitation`, trigger `handle_new_user`.
Frontend: `AppLayout`, `ProtectedRoute`, `TenantSwitcher`, `useAuth`, `usePermissions`, `constants/permissions.ts`, `lib/permissions.ts`.
Criterio de aceptación: login + creación de tenant + invitación + switch.

### Etapa 2 — Contactos + Pipeline (núcleo CRM)
Tablas: `companies`, `contact_stages`, `contact_sources`, `contact_tags`, `contacts`, `pipelines`, `pipeline_stages`, `deals`, `deal_stage_history`, `product_categories`.
Triggers: `log_deal_stage_change`, seeds de catálogo.
Frontend: `/contacts` (kanban + list + form + import), `/pipeline` (Kanban + list + drawer + forecast KPIs + filtros).
Criterio: alta/edición/movimiento de deals con historial.

### Etapa 3 — WhatsApp
Tablas + edge functions webhook/send/verify + normalización E.164.
Frontend: `/whatsapp` inbox interno, composer, templates, sidepanel.
BYO-WABA wizard opcional en esta etapa o Etapa 8.
Criterio: mensaje entrante → conversación + envío outbound con `sent_by_user_id`.

### Etapa 4 — Tareas + Mi Día + cierre con evidencia
Tabla `tasks`, `activities`.
Librerías `lib/tasks/{closure,autoClose}.ts`.
Página `/mi-dia` con 6 chips y diálogos.
Modo simple (`ui_prefs.mode`, `ContactDetailSimple`, tour).
Criterio: task con evidencia + auto-close por mensaje entrante.

### Etapa 5 — Metas + Gastos + Reportes
Metas: `tenant_monthly_goals`, `monthly_goals`, `monthly_goal_assignments`, `monthly_goal_history`, triggers no-past, `suggest_goal_split`.
Gastos: `expenses`, `expense_categories`, `expense_rules`, `recurring_expenses`, triggers y cron.
KPIs: `get_user_run_rate`, `get_user_profitability`.
Frontend: `RunRateCard`, `ProfitabilityCard`, `/gastos`, `/equipo`, `/reports`.
Criterio: RunRate y margen coherentes por usuario y tenant.

### Etapa 6 — IA base (Copiloto + memoria)
Tablas: `ai_conversation_history`, `ai_entity_context`, `ai_memory_events`, `ai_proactive_suggestions`, `ai_outcome_feedback`, `ai_user_profile`, `ai_tenant_patterns`, `ai_usage_log`.
Edge functions: `ai-copilot` (con tools nativas y guardrail), `ai-context-updater`, triggers de contexto.
Frontend: `CopilotDrawer`, `store/copilot`, `constants/copilotSuggestions`, `lib/ai/citations`.
Criterio: conversación por contexto de ruta/entidad, con guardrail y citations.

### Etapa 7 — Capacidades configurables + agentes
Tablas: `copilot_capabilities`, `copilot_action_log`, `ai_agents`, `ai_agent_runs`.
Edge functions: `copilot-builder`, `ai-agent-runner`, `aprendiz-backfill`.
Cron: `ai_run_due_agents` + service_role_key en `app.settings`.
Frontend: Settings → Copiloto (`CopilotCapabilitiesTab`, `NewCapabilityWizard`).
Criterio: crear recipe custom + ejecución con confirmación + agente corre por cron.

### Etapa 8 — Widgets configurables + módulos + marketplace
Tablas: `dashboard_widgets`, `dashboard_layouts`, `tenant_modules`, `plan_limits`, `org_plan_limits`.
Frontend: `LayoutRenderer`, `CustomizeSheet`, `WidgetsTab`, `/marketplace`.
Criterio: admin define default por tenant/rol; usuario personaliza el suyo.

### Etapa 9 — Automatizaciones + auditoría + notificaciones + email
Tablas: `automations`, `automation_runs`, `audit_log`, `notifications`, `notifications_queue`, `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, `email_send_state`.
Colas pgmq + cron `email_queue_dispatch/wake`.
Edge: `process-email-queue`, `auth-email-hook`, `notifications-digest`.
Frontend: `/automations` completo, `NotificationsBell`, tab Actividad.

### Etapa 10 — Pulido y observabilidad
`ai_cleanup_old_data` cron, `downgrade_expired_trials` cron.
`TrialBanner`, `OnboardingTour`, `CommandPalette`.
Métricas admin `/admin/ai-metrics`.
Landing/Pricing/Privacy/Terms si aplica.

---

## 9. Riesgos y decisiones a tomar antes de migrar

1. **Auth**: ¿mantienes Supabase Auth o migras a la de tu base AI-first? Impacta triggers `handle_new_user` y RLS.
2. **Storage**: bucket `tenant-assets` — replicar o migrar assets.
3. **Cron/queues**: pg_cron + pgmq son específicos de Postgres/Supabase — evaluar equivalentes.
4. **Edge Functions Deno**: si tu base usa Node/Bun, portar imports (`npm:` → estándar) y `Deno.env` → `process.env`.
5. **Tool registry del Copiloto**: alinear con el patrón AI-first de tu base para no duplicar orquestación.
6. **Terminología**: preservar mapping `deals` (BD/tools) ↔ "Oportunidad" (UI).
7. **Modo simple vs advanced**: mantener `ui_prefs` o unificar.

---

## 10. Entregable esperado

Este documento sirve como blueprint. Para cada etapa se sugiere:
- Migración SQL propia (schema + GRANTs + RLS + policies + seeds).
- Contratos de tipos generados (`supabase gen types` o equivalente).
- Suite mínima de smoke tests por dominio.
- Feature flag por etapa para activarla en producción sin romper la base AI-first.
