# Separar lo de Refrigeración G&R del resto de tenants

## El problema

Varias cosas que se construyeron para Refrigeración G&R están escritas "a mano" en el código y aparecen igual en cualquier tenant nuevo como SCALA (Utel):

- Tipos de oportunidad fijos: **Venta / Servicio / Refacción** (metas por tipo, Run Rate, tarjetas de Mi Día, reglas de gastos).
- Pestañas de **Servicios recurrentes** y **Agenda del mes** en Automatizaciones, y la tarjeta **"Mantenimientos del mes"** en Mi Día: hoy se muestran siempre, sin condición.
- Plantillas de pipeline fijas: Ventas / Mantenimiento / **Refacciones** / Renovaciones.
- Textos de seguimiento con vocabulario de refrigeración ("Avísale de la refacción", mensajes sugeridos de refacción/cobro).
- La guía del Copilot menciona "mantenimientos, cambio de filtro" como ejemplo para todos.

Lo que ya está bien aislado por tenant (no hay que tocar): contactos, etiquetas, fuentes, categorías de producto, categorías de gasto, pipelines y etapas, recurrencias — todo eso ya vive en la base con RLS por tenant.

## La solución

Convertir lo específico del giro en **configuración del tenant**, con valores por defecto genéricos. Refrigeración G&R conserva exactamente lo que tiene hoy; los tenants nuevos arrancan limpios.

### 1. Interruptores de funciones por tenant

Nuevas banderas en el tenant (todas apagadas por defecto, encendidas para Refrigeración G&R):

- `feature_recurrences` — muestra/oculta "Servicios recurrentes", "Agenda del mes" y la tarjeta de mantenimientos de Mi Día.
- `feature_expenses` — módulo de Gastos y rentabilidad.
- `feature_deal_types` — metas y reportes desglosados por tipo de oportunidad.

Se administran en Ajustes > Espacio de trabajo (solo propietario/admin), y también quedan expuestas a la plataforma.

### 2. Tipos de oportunidad configurables

Hoy `venta / servicio / refaccion` está escrito en el código. Se pasa a una lista editable por tenant (clave + etiqueta + orden), que alimenta:

- Metas por tipo y Run Rate (Mi Día y Dashboard)
- Reglas de gastos por tipo
- Filtros del Pipeline y Reportes

Semilla por defecto para tenants nuevos: solo **Venta**. Refrigeración G&R se siembra con Venta / Servicio / Refacción para no romper sus datos ni sus metas actuales.

### 3. Plantillas de pipeline por industria

La lista fija se sustituye por plantillas filtradas según la industria capturada en el onboarding, más una opción "Pipeline en blanco". Refacciones/Mantenimiento solo aparecen en giros de servicio técnico.

### 4. Vocabulario de seguimiento

Los textos sugeridos con jerga de refrigeración se vuelven neutros ("Avísale del pedido / entrega"), y los específicos quedan disponibles solo cuando el tenant tiene los tipos correspondientes activos. La guía del Copilot deja de citar "cambio de filtro" como ejemplo universal.

### 5. Limpieza de SCALA (Utel)

Revisión del tenant recién creado para quitar cualquier resto sembrado con vocabulario de refrigeración (etiquetas, plantillas de mensaje, categorías, pipelines de ejemplo) y dejarlo con la base genérica.

## Detalles técnicos

- Migración: columnas booleanas `feature_recurrences`, `feature_expenses`, `feature_deal_types` en `public.tenants` (default `false`); `UPDATE` puntual para poner `true` en el tenant de Refrigeración G&R.
- Nueva tabla `deal_types` (`tenant_id`, `key`, `label`, `position`, `is_active`) con GRANTs a `authenticated`/`service_role` y RLS por `get_user_tenant(auth.uid())`; trigger de seed con "Venta" para tenants nuevos; seed manual de los tres tipos para Refrigeración G&R.
- Hook `useTenantFeatures()` + `useDealTypes()`; se reemplazan los literales en `runRate.ts`, `MiDia.tsx`, `GoalBuilderDialog.tsx`, `AdvancedGoalsCard.tsx`, `GoalsTab.tsx`, `ExpenseRulesTab.tsx`, `expenses.ts`.
- Gating condicional en `Automations.tsx` (pestañas `recurrence` y `agenda`), `MiDia.tsx` (`MonthServicesInline`, widget `midia.recurrences`) y en la ruta/nav de Gastos.
- Plantillas de pipeline: mover `TEMPLATES` de `PipelineTab.tsx` y `PipelineManagerDialog.tsx` a un catálogo con etiqueta de industria.
- Textos: `src/lib/tasks/closure.ts`, `src/components/contacts/simple/PendingList.tsx`, `supabase/functions/_shared/walix-guide.ts`.
- Sin cambios en datos existentes de Refrigeración G&R: sus deals conservan su `deal_type` actual.
