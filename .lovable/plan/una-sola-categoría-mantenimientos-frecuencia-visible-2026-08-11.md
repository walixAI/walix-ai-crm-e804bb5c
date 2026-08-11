# Una sola categoría "Mantenimientos" + frecuencia visible

## Problema
Hoy conviven tres categorías: "Mantenimientos", "Mantenimiento 6M" y "Mantenimiento 12M" (más "Cambio de Filtro 12M"). El usuario tiene que elegir entre varias que significan lo mismo, y los filtros del Pipeline se fragmentan.

## Propuesta
Dejar **una sola categoría general "Mantenimientos"** y mover lo semestral/anual a un atributo aparte: **Frecuencia** (Semestral / Anual / Única).

Así:
- La categoría responde "¿qué es?" → Mantenimientos.
- La frecuencia responde "¿cada cuándo?" → Semestral (6M) o Anual (12M).
- En las tarjetas y tablas se ve una etiqueta pequeña: `Mantenimientos · Semestral`.

## Qué se hace

1. **Nuevo campo Frecuencia en la oportunidad**
   - Valores: Semestral (6 meses), Anual (12 meses), Única / sin recurrencia.
   - Se llena automáticamente desde la recurrencia cuando la oportunidad la genera (ya existen "Mantenimiento semestral", "Mantenimiento anual", "Cambio de filtro semestral/anual").
   - Editable a mano desde el panel de la oportunidad.

2. **Consolidación de categorías (migración de datos)**
   - Las 22 oportunidades de "Mantenimiento 6M" → categoría "Mantenimientos" + frecuencia Semestral.
   - Las 9 de "Mantenimiento 12M" → "Mantenimientos" + frecuencia Anual.
   - "Cambio de Filtro 12M" → se renombra a "Cambio de filtro" y su oportunidad queda con frecuencia Anual.
   - Se desactivan (no se borran) las categorías 6M/12M para no romper históricos.

3. **UI**
   - Tarjeta de oportunidad y tabla de desempeño: badge `Mantenimientos` + badge de frecuencia.
   - Filtro de categorías del Pipeline: queda solo "Mantenimientos"; se agrega un filtro de **Frecuencia** al lado (Todas / Semestral / Anual).
   - "Mi Día" (panel de prioridad por categoría) y metas por categoría usan la categoría consolidada.

4. **Sin cambios para el usuario final al capturar**: al crear una oportunidad de mantenimiento solo elige "Mantenimientos" y, si aplica, la frecuencia.

## Detalles técnicos
- Migración: columna `deals.service_frequency_months smallint` (6, 12 o null) + backfill desde `product_categories.name` y desde `recurrence_definitions.period_months` vía `recurrence_occurrences.generated_deal_id`.
- El generador de recurrencias (`recurrence_fill_horizon` / worker que crea deals) escribe `service_frequency_months` y asigna siempre la categoría general.
- `UPDATE product_categories SET is_active = false` para "Mantenimiento 6M" y "Mantenimiento 12M"; `deals.product_category_id` repunta a "Mantenimientos".
- Frontend: `src/lib/queries/pipeline.ts` y `miDia.ts` seleccionan el nuevo campo; `DealsPerformanceView.tsx` agrega el filtro de frecuencia; `DealDrawer.tsx` agrega el selector.
