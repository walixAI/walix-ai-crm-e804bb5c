# Ronda 5 — Perfil, Tareas globales, IA con permisos y fixes

## 1) Página de Perfil (`/app/profile`)

Nueva ruta accesible desde avatar del `TopBar`. Incluye **todos** los bloques:

- **Identidad**: avatar (subir a `tenant-assets`), nombre, email, teléfono, puesto, zona horaria, idioma. Rol visible y tenant activo.
- **Actividad 30d**: contactos creados, oportunidades ganadas/perdidas, monto cerrado, tareas completadas, llamadas/notas registradas. `last_seen_at`, miembro desde.
- **Preferencias**: tema, densidad, notificaciones in-app on/off por categoría, **hora del recordatorio diario** (default 08:00, editable), firma de email, saludo WhatsApp.
- **Seguridad**: cambiar contraseña, cerrar otras sesiones, 2FA (placeholder).
- **Equipo**: tenants donde participa + `TenantSwitcher`, lista de permisos efectivos.

Migración mínima: agregar columnas a `profiles` → `phone text`, `job_title text`, `timezone text`, `locale text`, `signature text`, `wa_greeting text`, `reminder_hour smallint default 8`, `notification_prefs jsonb default '{}'`.

## 2) IA según rol

- **`tenant_owner` / `tenant_admin`**: la IA puede ejecutar acciones de configuración (stages, sources, pipelines, automations, invitar usuarios).
- **Vendedor (`sales_rep`)**: la IA solo opera contactos, oportunidades, tareas y actividades.

Cambios:
- `ai-execute/index.ts`: leer `user_roles` al inicio. `ALLOWED_TOOLS_BY_ROLE` con whitelist; rechazar 403 fuera del set.
- `global-ai/index.ts`: filtrar `tools[]` enviadas al modelo según rol; reforzar system prompt ("Como vendedor solo puedes…").
- Nuevas tools admin: `propose_create_stage`, `propose_create_source`, `propose_create_automation`, `propose_invite_user` (con confirmación humana antes de ejecutar).

## 3) Sección global de Tareas

Nueva ruta `/app/tasks` → `src/pages/app/Tasks.tsx`. Item nuevo en `Sidebar.tsx` y `BottomNav.tsx`.

Tabs: **Hoy · Próximas · Vencidas · Completadas · Todas**.
Filtros: asignado a (mí / cualquiera), contacto, oportunidad, rango de fecha.
Acciones: completar, reasignar, reprogramar (popover), abrir contacto/oportunidad, eliminar.

Hooks nuevos en `src/lib/queries/tasks.ts`: `useTasks(filters)`, `useUpdateTask`, `useDeleteTask`, `useCreateTask`. Reutilizar `QuickTaskDialog` para crear.

## 4) Dashboard — tarjetas de tareas

En `Dashboard.tsx`, debajo del KPI hero:
- **Tareas vencidas (rojo)**: hasta 5 con `due_at < now() AND !completed AND assignee_id = me`. Link "Ver todas" → `/app/tasks?view=overdue`.
- **Próximas tareas (7d)**: hasta 5. Link "Ver todas" → `/app/tasks?view=upcoming`.
Item: título, contacto, fecha relativa, checkbox para completar inline.

## 5) Recordatorios IA (in-app)

- Edge function `ai-task-reminders` ejecutada por `pg_cron` cada hora; para cada usuario revisa si la hora actual (en su `timezone`) coincide con su `reminder_hour` y, si tiene tareas vencidas o que vencen hoy, inserta `notifications` (`type='task_reminder'`).
- `global-ai`: al iniciar conversación, si el usuario tiene tareas vencidas, saludo proactivo "Tienes N tareas vencidas — ¿quieres reprogramar?".
- Tools nuevas en `ai-execute`: `complete_task`, `reschedule_task` para que el usuario diga "marca como hecha la llamada a Francisco".

Sin envío por email en esta ronda.

## 6) Bug: salud de pipeline = 79 sin datos

En `src/lib/pipelineHealth.ts` los componentes con denominador 0 devuelven 1 o 0.5, lo que da ~79. Fix: si `activeDeals === 0 && totalOpenConversations === 0 && wonLast30 + lostLast30 === 0 && weightedForecast === 0`, retornar:

```
{ score: 0, status: "warning", summary: "Aún no hay datos suficientes para calcular la salud del pipeline.", components: [], topIssues: [] }
```

UI (`ForecastKpis` y panel) muestra "Sin datos · —" cuando `components.length === 0`.

## 7) Limpieza UI tab Actividades

En `ActivitiesTab.tsx` eliminar la fila de botones shortcut (Nota/Llamada/Reunión/Email cuando `tab === "all"`, líneas ~46-54). El usuario crea desde el botón `+` global del header.

## 8) "Agendar llamada" en Resumen → popup de tarea

Cambiar `LogActivityDialog` por `QuickTaskDialog` precargado:
- `title = "Llamada con {contact.name}"`
- `contact_id = contact.id`, `assignee_id = user.id`
- `due_at = mañana 10:00` (editable)

Mismo cambio para "Próximo paso sugerido" cuando `top.action === "task"`. La tarea aparecerá en "Próximas tareas" del aside, en `/app/tasks`, y en el timeline (ver punto 9).

## 9) Tareas en el timeline del contacto

Hoy `useContactActivity` solo trae registros de `activities`. Ampliarlo para mezclar tareas:

- Modificar `useContactActivity(contactId)` en `src/lib/queries/contacts.ts` para hacer dos queries (activities + tasks del contacto) y mergearlas por fecha (`occurred_at` vs `due_at ?? created_at`).
- Mapear cada tarea a un `ActivityRow` virtual con `type: "task"`, descripción = `title`, metadata `{ taskId, completed, dueAt }`.
- En `ActivityItem.tsx` para `type==="task"`: mostrar checkbox para completar, badge "vencida" si aplica, link a abrir/editar.
- Resultado: aparecen automáticamente en **Resumen → "Últimos eventos"** (que muestra `recent = activity.slice(0,5)`) y en **Actividades → tab "Todas"** (sin tocar SummaryTab ni la lógica de filtros).
- Al filtrar por "Tareas" en `ActivitiesTab`, se sigue mostrando `TasksTab` (vista completa con CRUD); los demás filtros (Notas/Llamadas/...) excluyen tareas.

## Archivos a tocar / crear

Nuevos:
- `src/pages/app/Profile.tsx`, `src/pages/app/Tasks.tsx`
- `src/lib/queries/tasks.ts`, `src/lib/queries/profile.ts`
- `src/components/dashboard/TaskCards.tsx`
- `supabase/functions/ai-task-reminders/index.ts`

Editados:
- `src/App.tsx` (rutas), `src/components/layout/{Sidebar,BottomNav,TopBar}.tsx`
- `src/pages/app/Dashboard.tsx`
- `src/lib/pipelineHealth.ts` + consumidores en pipeline UI
- `src/components/contacts/detail/ActivitiesTab.tsx`
- `src/components/contacts/detail/SummaryTab.tsx`
- `src/components/contacts/detail/ActivityItem.tsx`
- `src/lib/queries/contacts.ts` (merge activities + tasks)
- `supabase/functions/ai-execute/index.ts`, `supabase/functions/global-ai/index.ts`

Migración:
- ALTER `profiles` agregar columnas (phone, job_title, timezone, locale, signature, wa_greeting, reminder_hour, notification_prefs).
- Cron `pg_cron` cada hora invocando `ai-task-reminders`.

Sin cambios en otras tablas.
