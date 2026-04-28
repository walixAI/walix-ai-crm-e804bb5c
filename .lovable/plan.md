
# Plan: Módulo Pipeline Kanban

## Estado actual

- `/pipeline` muestra el componente `Stub` genérico.
- Ya existen tablas reales en Supabase: `deals`, `pipeline_stages`, `contacts`, `activities`, `ai_suggestions`, `tasks`, `conversations` con RLS por `tenant_id`.
- Hay **6 etapas** del seed (`Nuevo Lead, Contactado, Calificado, Propuesta, Negociación, Cerrado`) y **8 deals** de prueba. La spec pide 7 etapas (separar Cerrado Ganado / Cerrado Perdido) y 15 deals.
- Los seeds usan tenant fijo `11111111-...`. La UI ya consume datos reales mediante hooks en `src/lib/queries/*`.
- React Query, Tailwind, shadcn, Vaul (drawer), `react-day-picker` ya instalados. **Falta `@dnd-kit/core` + `@dnd-kit/sortable`**.

## Cambios de base de datos (migración)

1. Renombrar etapa `Cerrado` → `Cerrado Ganado` y agregar `Cerrado Perdido` (position 7) para el tenant seed.
2. Agregar columna `pipeline_stages.color text` (default neutral) para el círculo configurable de cada columna.
3. Agregar columna `pipeline_stages.is_won boolean` y `is_lost boolean` para identificar etapas terminales.
4. Insertar **7 deals adicionales** (total 15) repartidos entre las 7 etapas con montos $5k–$150k MXN, fechas de cierre variadas y `owner_id` rotativo (NULL — el `ownerFromId` mapea a vendedores mock).
5. Insertar 2–3 `ai_suggestions` con `contact_id` ligado a deals destacados para el tab IA del drawer (no hay `deal_id` en la tabla; se buscarán por `contact_id` del deal).
6. Insertar 4–5 `tasks` con `deal_id` para mostrar el icono 📋 en las tarjetas con tareas pendientes.

No se crean tablas nuevas — el modelo actual cubre todo.

## Dependencias nuevas

- `@dnd-kit/core` y `@dnd-kit/sortable` para drag-and-drop accesible.

## Archivos nuevos

```text
src/lib/queries/pipeline.ts          // hooks: useStages, useDeals, useUpdateDealStage,
                                      // useUpdateDealAmount, useCreateDeal, useDealTasks,
                                      // useUnreadByContact
src/components/pipeline/
  PipelineHeader.tsx                  // nombre+dropdown, toggle vista, filtros, +Nuevo Deal, totales
  PipelineFilters.tsx                 // popover con vendedor, monto min/max, fecha, fuente, tag
  KanbanBoard.tsx                     // DndContext + columnas + sensors
  KanbanColumn.tsx                    // header (color, nombre, count, total, +) + droppable
  DealCard.tsx                        // tarjeta arrastrable con todos los chips/badges
  DealsListView.tsx                   // tabla ordenable + export CSV
  PipelineFooter.tsx                  // sticky bottom slate-800 con totales por columna
  NewDealDialog.tsx                   // modal con react-hook-form + zod
  DealDrawer.tsx                      // drawer 480px con tabs Resumen | Actividad | IA
  drawer/DealSummaryTab.tsx
  drawer/DealActivityTab.tsx          // reusa estilo timeline de SummaryTab de contactos
  drawer/DealAiTab.tsx                // sugerencias + explicación probabilidad + botón bloqueado
```

## Archivos modificados

- `src/App.tsx` — reemplazar `Stub` de `/pipeline` por nueva página `Pipeline`.
- `src/pages/app/Pipeline.tsx` (nuevo) — orquesta header/board/lista/drawer/modal/footer.
- `package.json` — añadir dnd-kit.

## Detalle por componente

**PipelineHeader**
- Selector de pipeline (un solo pipeline real por ahora; dropdown muestra el actual + opción "Nuevo pipeline" deshabilitada).
- `ToggleGroup` Kanban / Lista.
- Botón filtros abre `Popover` con `Select` vendedor (mock sellers), inputs monto min/max, datepicker rango, select fuente, multiselect tags.
- Botón **+ Nuevo Deal** primary indigo (`bg-primary`).
- Línea de totales: `Pipeline total: $X MXN · N deals activos` (excluye won/lost).

**KanbanBoard**
- `DndContext` con `PointerSensor` + `KeyboardSensor`.
- `overflow-x-auto` con columnas `min-w-[280px]`.
- `onDragEnd`: si la columna destino cambió → mutación que actualiza `stage_id`, `stage_name`, y si la etapa es terminal marca `is_won`/`is_lost`. Optimistic update vía React Query.

**KanbanColumn**
- Header: círculo `stage.color`, nombre, badge con `deals.length`, total formateado MXN, botón `+` que abre `NewDealDialog` con etapa precargada.
- Lista de `DealCard` con scroll vertical interno.

**DealCard**
- Calcula `daysInStage` desde `updated_at` (al cambiar etapa también se actualiza). Badge naranja >5, rojo >10.
- Probabilidad pintada como barra fina absoluta abajo (verde/amarillo/rojo según rangos).
- Icono 📋 si `useDealTasks(deal.id)` tiene alguna `completed=false`.
- Icono 💬 + conteo `conversations.unread_count` por `contact_id`.
- Click: abre drawer. Click en monto: input inline (`onBlur` guarda). Click en chip de contacto: `navigate("/contacts/:id")` con `e.stopPropagation()`.

**DealDrawer (Vaul + side="right" 480px)**
- Tabs Resumen | Actividad | IA.
- Resumen: campos editables (monto, etapa, fecha cierre, probabilidad slider, fuente texto, notas textarea — la tabla `deals` no tiene `notes`/`source`; se agregarán en la migración como `notes text` y `source lead_source default 'Manual'`).
- Actividad: `activities` filtradas por `deal_id`.
- IA: sugerencias por `contact_id` del deal + bloque heurístico de explicación (alta/media/baja según probabilidad y `last_activity_at` del contacto) + botón "Generar propuesta PDF" deshabilitado con badge "Pro".

**PipelineFooter**
- Sticky bottom dentro del contenedor de la página, una celda por etapa con MXN acumulado + celda total. Fondo `bg-slate-800` texto blanco.

**DealsListView**
- `<Table>` shadcn con sort por columna (estado local). Botón "Exportar CSV" genera blob client-side desde `deals` filtrados.

**NewDealDialog**
- React Hook Form + Zod. Campos: nombre*, monto MXN*, etapa (Select de stages), contacto (Command/search sobre `useContacts`), vendedor (mock), fecha (DatePicker shadcn), fuente, notas, probabilidad (Switch IA-auto vs Slider manual; auto = 50 hasta tener IA real).
- Inserta en `deals` con `tenant_id` resuelto vía `useTenantId()`.

## Comportamiento de filtros

Estado de filtros en la página, aplicado en cliente sobre el resultado de `useDeals` (sin re-fetch). Persistencia simple en URL search params para compartir vistas (opcional, baja prioridad si se complica).

## Datos de prueba

Migración inserta:
- 7 deals adicionales (total 15) con mezcla de etapas, montos `15000, 32000, 58000, 7500, 125000, 150000, 95000`, fechas mayo–julio 2026.
- 1 deal en `Cerrado Ganado` con `is_won=true`, 1 en `Cerrado Perdido` con `is_lost=true`.
- 4 tasks con `deal_id` (3 pendientes, 1 completada).
- 3 ai_suggestions adicionales para los deals de mayor monto.

## Validación

- `useDeals` excluye won/lost del conteo "deals activos" pero los incluye en sus columnas.
- RLS ya existe; las nuevas mutaciones funcionarán al pasar `tenant_id`.
- DnD entre columnas dispara mutación con rollback en error (toast sonner).
- Vista responsive: en <768px el board hace scroll horizontal natural; el drawer ocupa 100% del ancho.
