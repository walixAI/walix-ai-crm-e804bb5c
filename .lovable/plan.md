# Filtro de resultados por etapa: creadas vs ganadas este mes

## Contexto
Hoy el Pipeline (Kanban/Lista) solo muestra oportunidades activas. Las ganadas y perdidas desaparecen de esas vistas y solo se ven en la pestaña **Desempeño**. El usuario quiere poder seleccionar, dentro del Pipeline, aquellas oportunidades que se **crearon este mes** o que se **ganaron este mes**, y seguir viéndolas agrupadas por etapa.

## Mejor camino
Agregar un **lente de pipeline** en la vista Kanban/Lista con tres opciones:

- **Activas** (comportamiento actual): solo abiertas.
- **Creadas este mes**: todas las oportunidades creadas en el mes en curso, agrupadas por su etapa actual (activa, ganada o perdida).
- **Ganadas este mes**: oportunidades con `is_won = true` y `won_at` dentro del mes en curso, agrupadas por etapa.

Esto mantiene la experiencia de Kanban/List por etapas y no obliga al usuario a saltar a Desempeño.

## Cambios técnicos

### 1. Preferencias de Pipeline
- En `src/lib/usePipelinePrefs.ts` agregar `pipelineLens: "active" | "created" | "won"` al interface `PipelinePrefs` y al default.

### 2. UI del selector
- En `src/components/pipeline/PipelineHeader.tsx` agregar un `Select` o `ToggleGroup` junto a los filtros con las opciones: Activas / Creadas este mes / Ganadas este mes.
- Solo mostrar el selector cuando `view` sea `kanban` o `list` (no en Desempeño, que ya tiene sus propios lentes).

### 3. Lógica de filtrado
- En `src/pages/app/Pipeline.tsx`:
  - Calcular `monthStart` y `monthEnd` del mes en curso.
  - Según `prefs.pipelineLens`:
    - `active`: filtrar `!isWon && !isLost` (como hoy).
    - `created`: incluir deals cuyo `createdAt` esté dentro del mes actual; seguir aplicando los filtros laterales (vendedor, monto, fuente, etiqueta, búsqueda).
    - `won`: incluir deals con `isWon && wonAt` dentro del mes actual; aplicar los mismos filtros laterales.
  - Ajustar `activeDeals`, `totalAmount`, `weightedAmount`, `closingThisMonth`, `staleDeals` para que se calculen sobre el conjunto seleccionado por el lente, no sobre activas a secas.

### 4. Indicadores visuales
- En `src/components/pipeline/KanbanBoard.tsx` y `DealsListView.tsx` distinguir tarjetas ganadas (badge/check verde, opacidad reducida o borde) y perdidas (gris/rojo) cuando el lente las muestra.
- Evitar que las acciones de arrastrar entre etapas estén disponibles para tarjetas ganadas/perdidas en los lentes "creadas"/"ganadas".

### 5. Estados vacíos
- Actualizar los mensajes de `EmptyState` en `Pipeline.tsx` para cada lente:
  - "No hay oportunidades activas" / "No se crearon oportunidades este mes" / "No se ganaron oportunidades este mes".

### 6. Persistencia
- Guardar la selección del lente en `localStorage` vía `usePipelinePrefs` para que al regresar al Pipeline conserve la última vista.

## Alcance fuera de este plan
- No se agrega filtro de "perdidas este mes" a menos que el usuario lo pida; se puede extender fácilmente con el mismo patrón.
- No se modifica la vista Desempeño.
- No se cambian tablas ni RLS; se usa `created_at` y `won_at` ya disponibles en `PipelineDeal`.
