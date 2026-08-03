## Situación actual

En el detalle del contacto, el panel **Oportunidades** (`src/components/contacts/detail/DealsSidePanel.tsx`) ya pinta la etapa actual de cada deal como una insignia, pero:

- la tarjeta no es clicable, así que no se puede abrir el deal ni su historial
- no se ve el progreso dentro del pipeline (en qué paso va de cuántos)
- el historial de cambios de etapa (con badge "Auto" de las reglas automáticas) solo existe dentro del `DealDrawer`, accesible únicamente desde Pipeline

## Qué construir

**1. Pestaña "Oportunidades" junto a Actividades**
Agregar una pestaña propia en el detalle del contacto, al lado de Actividades / Tareas / Notas, con la lista completa de oportunidades del contacto: nombre, monto, probabilidad, etapa actual, pipeline al que pertenece, responsable y fecha de última actividad. Incluye las cerradas (ganadas/perdidas) con filtro Activas / Todas.

**2. Tarjeta de oportunidad clicable**
Tanto en la pestaña nueva como en el panel lateral, al hacer clic se abre el `DealDrawer` (el mismo componente del Pipeline), directamente en la pestaña de historial cuando el usuario llega buscando etapas.

**3. Mini-stepper de etapas**
Debajo del nombre del deal, una barra de pasos con las etapas del pipeline correspondiente: etapas completadas en color de marca, la actual resaltada, las pendientes en gris. Tooltip con el nombre de cada etapa y texto tipo "Etapa 3 de 6 · Contactado".

**4. Historial de etapas visible desde el contacto**
Dentro del drawer, la línea de tiempo de `deal_stage_history` ya existente: fecha, etapa origen → destino, quién lo movió y badge **Auto** si fue una regla automática.

**5. Cambios de etapa en el timeline del contacto**
Los movimientos de etapa aparecen intercalados en la pestaña Actividades (junto a mensajes, tareas y notas), para ver el avance sin abrir nada.

## Detalles técnicos

- Nuevo componente `src/components/contacts/detail/DealsTab.tsx` montado en el sistema de pestañas de `ContactDetail.tsx`.
- Extender `useContactDeals` para traer `pipeline_id`, `stage_id`, estado de cierre y el orden de la etapa; cargar `pipeline_stages` para construir el stepper.
- Reutilizar `DealDrawer` del módulo Pipeline, controlado por estado local (`selectedDealId`), sin duplicar lógica.
- Nueva query de `deal_stage_history` filtrada por los deals del contacto para el timeline unificado.
- Sin cambios de esquema: las tablas y triggers necesarios ya existen.
