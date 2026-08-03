# Cambiar etapas sin romper resultados ni oportunidades

## Qué pasa hoy (verificado en la base de datos)

Cuando el tenant elimina una etapa desde Ajustes → Pipeline y guarda, hoy ocurre **en silencio**:

- **Oportunidades (deals)**: quedan sin etapa (el campo se vacía). Desaparecen del Kanban y del embudo.
- **Tipificaciones de esa etapa**: se **borran** junto con la etapa (las que estaban limitadas a esa etapa).
- **Tipificaciones que movían a esa etapa**: pierden el destino y dejan de mover la oportunidad.
- **Reglas de avance automático** que salen o llegan a esa etapa: se **borran**.

Renombrar, recolorear o reordenar una etapa es seguro: nada se pierde.

## Qué se va a construir

### 1. Aviso de impacto antes de eliminar
Al pulsar el bote de basura en una etapa, un diálogo muestra el conteo real:
"Esta etapa tiene 12 oportunidades, 4 tipificaciones y 2 reglas de avance."

### 2. Migración obligatoria de las oportunidades
En ese mismo diálogo el tenant elige la **etapa destino** a la que se mueven las oportunidades de la etapa eliminada. Sin destino elegido no se puede eliminar (salvo que la etapa esté vacía). El movimiento queda registrado en el historial de etapas de cada oportunidad como cambio por reconfiguración.

### 3. Qué hacer con las tipificaciones
Tres opciones en el diálogo:
- **Mover a la etapa destino** (predeterminado): las tipificaciones se reasignan y se siguen usando.
- **Convertir en generales**: quedan disponibles en todas las etapas.
- **Eliminarlas**.
Las tipificaciones que *apuntaban* a la etapa eliminada se reapuntan automáticamente a la etapa destino.

### 4. Reglas de avance automático
Las reglas que usaban la etapa se reapuntan a la etapa destino; si eso genera una regla sin sentido (origen = destino) se desactiva y se avisa en el resumen.

### 5. Al agregar una etapa nueva
Tras guardar, un aviso sugiere "Agregar tipificaciones para esta etapa", con un atajo a Ajustes → Seguimiento y la opción de copiar las tipificaciones de una etapa existente.

### 6. Guardado más seguro
Guardar etapas dejará de eliminar en silencio: solo se eliminan las etapas confirmadas mediante el diálogo de impacto.

## Detalles técnicos

- Nueva función de base de datos `delete_pipeline_stage(_stage_id, _target_stage_id, _outcome_action)` que dentro de una sola transacción: reasigna `deals.stage_id`/`stage_name`, escribe en `deal_stage_history`, aplica la acción sobre `activity_outcomes` (mover / generalizar / eliminar), reapunta `moves_to_stage_id` y las `pipeline_stage_rules`, y por último borra la etapa.
- Consulta previa de conteos (deals, tipificaciones, reglas) para alimentar el diálogo.
- Nuevo componente `DeleteStageDialog.tsx` en `src/components/settings/pipeline/`, invocado desde `SortableStage` / `PipelineTab`.
- `handleSave` en `PipelineTab.tsx` deja de calcular borrados implícitos; las etapas nuevas y las ediciones se guardan igual.
- Copia de tipificaciones entre etapas mediante inserción por lote desde `activityOutcomes.ts`.
