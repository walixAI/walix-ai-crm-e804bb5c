# Registrar objeciones en seguimientos

## Contexto
El sistema actual registra seguimientos con **tipo de actividad + dirección** (llamada saliente, WhatsApp entrante, etc.) y una **tipificación de resultado** configurable por tenant (ej. "Contacto efectivo", "No contestó"). Sin embargo, no existe un campo estructurado para capturar **por qué un lead no avanza** (objeciones como "precio alto", "no es el momento", "decide otra persona", etc.).

## Objetivo
Permitir que el vendedor registre, al momento de cada seguimiento, una **objeción** elegida de un catálogo configurable por tenant. Esto será solo informativo: no moverá etapas, pero habilitará reportes para detectar patrones (por ejemplo, "cuántos leads se atoran por precio alto").

## Alcance

### 1. Catálogo de objeciones por tenant
- Nueva tabla `objections` en el esquema público con RLS.
- Campos: `tenant_id`, `label` (ej. "Precio alto"), `description`, `color`, `position`, `is_active`.
- CRUD en Ajustes → Seguimiento para que cada tenant administre sus propias objeciones.
- Semilla con objeciones recomendadas por pipeline/tenant.

### 2. Registro de objeción en cada seguimiento
- En `LogFollowUpDialog.tsx` agregar un campo opcional "Objeción / motivo de no avance".
- El campo usa el catálogo del tenant + opción "Ninguna / No aplica".
- Se guarda en `activities.metadata.objection_id` y `activities.metadata.objection_label`.
- También se mostrará en el detalle de actividad (`ActivityItem`) con un badge de color.

### 3. Reporte de objeciones
- Nuevo componente `ObjectionsReportCard.tsx` en Dashboard o Reportes.
- Muestra distribución de objeciones en el periodo seleccionado (conteo y monto de oportunidades afectadas).
- Permite filtrar por pipeline, etapa y vendedor.
- Indica cuáles deals están "atorados" con la misma objeción por más de N días.

### 4. Vista de oportunidad y contacto
- En `DealDrawer.tsx` y en el perfil del contacto, mostrar la objeción más reciente del deal/contacto.
- En la tabla de desempeño de oportunidades agregar filtro por objeción.

## No incluye
- No se crean etapas automáticas de objeción.
- No se envían notificaciones automáticas por objeción (se puede agregar después).
- No se integra con IA por ahora.

## Archivos a modificar / crear
- `supabase/migrations/...` — tabla `objections`, políticas RLS, grants, trigger de updated_at.
- `src/lib/queries/objections.ts` — hooks de CRUD y consulta.
- `src/components/activity/LogFollowUpDialog.tsx` — campo de objeción.
- `src/components/contacts/detail/ActivityItem.tsx` — mostrar objeción.
- `src/components/settings/outcomes/OutcomesTab.tsx` — administrar objeciones.
- `src/components/reports/ObjectionsReportCard.tsx` — reporte nuevo.
- `src/components/pipeline/DealsPerformanceView.tsx` — filtro por objeción.
- `src/components/pipeline/DealDrawer.tsx` — objeción más reciente.

## Criterios de aceptación
1. El tenant puede crear/editar/eliminar objeciones en Ajustes → Seguimiento.
2. Al registrar un seguimiento, el vendedor puede seleccionar una objeción del catálogo.
3. La objeción queda guardada en la actividad y visible en el feed.
4. Existe un reporte que muestre cuántas oportunidades tienen cada objeción y su monto.
5. La tabla de desempeño permite filtrar oportunidades por objeción.
