
# Tarjetas configurables (Dashboard + Mi Día)

Sistema unificado de "widgets" que aplica a las dos pantallas. El admin define un layout base por rol, y cada usuario puede ocultar/reordenar (sin eliminar las obligatorias). Se entrega en 3 fases.

## Modelo de datos (una sola vez, base de las 3 fases)

Tablas nuevas:

- `dashboard_widgets`: catálogo de widgets nativos y personalizados del tenant.
  - `id`, `tenant_id` (null = nativo global), `key` (slug único por tenant), `title`, `description`
  - `surface` enum: `dashboard` | `mi_dia` | `both`
  - `kind` enum: `native` | `custom_metric`
  - `native_key` (para nativos: `run_rate`, `profitability`, `won_sales`, `tasks_today`, etc.)
  - `config` jsonb (para custom: métrica, dimensión, filtros, visualización)
  - `min_role` enum: `user` | `admin` | `owner`  (quién puede ver)
  - `is_active`, `is_mandatory` (usuario no puede ocultarla), `created_by`
- `dashboard_layouts`: layout por scope.
  - `id`, `tenant_id`, `scope` (`tenant_default` | `role:<rol>` | `user:<uuid>`), `surface`, `items` jsonb `[{widget_id, position, hidden?}]`

Resolución del layout en runtime (cascada):
`user override → role default → tenant default → catálogo nativo`.

RLS: admins escriben catálogo y defaults de tenant/rol; cada usuario escribe solo su propio scope `user:<uuid>`.

## Fase 1 — Activar/desactivar y reordenar (MVP)

Alcance: catálogo fijo de widgets nativos ya existentes en la app.

Widgets nativos catalogados:
- Dashboard: KPIs actuales, Run Rate, Rentabilidad, AI widgets (Pipeline Health, Opportunities, Risks, Executive Summary, Weekly Report), gráficas de reportes.
- Mi Día: Tareas hoy, Por cobrar, Por cotizar, Servicios hoy, Seguimientos, Run Rate resumido, Rentabilidad resumida, Ventas ganadas.

UI:
- Configuración → nueva pestaña **"Tarjetas"** (visible para admin/owner):
  - Dos sub-tabs: Dashboard | Mi Día.
  - Lista drag-and-drop de widgets con toggle activo/oculto y switch "obligatoria" (solo admin).
  - Botón "Guardar como default del tenant" o "Guardar para rol X".
- Botón discreto **"Personalizar"** en la esquina superior de Dashboard y Mi Día:
  - Abre un sheet con la misma lista drag-and-drop pero limitada al scope `user:<uuid>`.
  - No permite ocultar widgets marcados como obligatorios.
  - Botón "Restablecer al default".

Refactor mínimo:
- `Dashboard.tsx` y `MiDia.tsx` pasan a renderizar `<WidgetRenderer widgetKey=... />` iterando el layout resuelto.
- Nuevo hook `useResolvedLayout(surface)` con la cascada.

## Fase 2 — Crear tarjetas simples con asistente

Wizard "Nueva tarjeta" en Configuración → Tarjetas → botón "+ Crear tarjeta".

Pasos del wizard:
1. **Métrica**: Ventas ganadas | Meta del mes | Run Rate | Gastos | Rentabilidad | Tareas | Deals abiertos | Contactos nuevos.
2. **Dimensión** (opcional): global | por vendedor | por pipeline | por categoría | por tipo de deal.
3. **Comparación** (opcional): vs meta | vs mes anterior | vs mismo mes año pasado.
4. **Periodo**: hoy | esta semana | este mes | mes actual vs anterior.
5. **Visualización**: KPI grande | KPI + progreso | lista top N | barra | mini gráfica.
6. **Filtros**: por owner, por pipeline, por categoría, por estado.
7. **Publicación**: superficie (Dashboard/Mi Día/ambas), scope (tenant/rol/usuario), visibilidad mínima por rol.

Se guarda en `dashboard_widgets.kind='custom_metric'` con `config` jsonb. El `WidgetRenderer` incluye un `<CustomMetricWidget config={...} />` que consulta primitivas seguras server-side (misma capa que hoy usa Run Rate/Rentabilidad).

Ejemplo del enunciado del usuario ("Tarjeta RunRate cruzando ventas vs metas") se cubre eligiendo: métrica=Ventas ganadas, comparación=vs meta, periodo=este mes, visualización=KPI + progreso.

## Fase 3 — Builder conversacional ("Walix Builder para tarjetas")

Extiende el patrón ya existente en `copilot-builder`:
- Nueva edge function `dashboard-widget-builder`.
- El admin describe la tarjeta en lenguaje natural ("muéstrame ventas vs meta por vendedor este mes").
- La función entrevista al admin (dimensión, periodo, filtros, visualización, scope, roles) y produce el mismo JSON `config` de la Fase 2.
- Antes de activarla se muestra vista previa con datos reales.
- Solo puede combinar primitivas del catálogo seguro (nada de SQL libre) para respetar RLS y tenant isolation.

Punto de entrada: mismo botón "+ Crear tarjeta" con dos opciones: "Con asistente guiado" (Fase 2) o "Describir en lenguaje natural" (Fase 3).

## Detalles técnicos

- Reutilizar `RunRateCard`, `ProfitabilityCard`, `RunRateChip`, `DashboardAiSection`, `TaskCards`, `MorningBriefing`, etc. envolviéndolos en un registry `WIDGET_REGISTRY: Record<nativeKey, ComponentType>`.
- `dnd-kit` (ya disponible) para el drag-and-drop.
- Guardar `ui_prefs.dashboard_layout` y `ui_prefs.mi_dia_layout` en `profiles` como shortcut del scope `user:<uuid>` (evita joins extra en el render).
- Migración incluye `GRANT`s + policies + trigger de `updated_at`; seed inicial del catálogo nativo con los widgets actuales.
- Copilot: agregar primitivas `list_dashboard_widgets`, `toggle_widget`, `reorder_widgets` para que el admin también configure por chat (opcional, al final de Fase 1).

## Entregable de esta iteración

Aprobar el plan completo. Ejecución sugerida: Fase 1 primero (2-3 pasos de código: migración + registry + UI de configuración + botón Personalizar), luego Fase 2, luego Fase 3.
