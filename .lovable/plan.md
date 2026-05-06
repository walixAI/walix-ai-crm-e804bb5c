## Issues encontrados y plan de implementación

### 1) Fuente de prospección no se puede cambiar para contactos nuevos

**Causa**: en `ContactInfoCard.tsx` al cambiar fuente se guarda `source` (columna ENUM `lead_source` con sólo 4 valores: WhatsApp/Formulario web/Referido/Manual) además de `source_id`. Si la fuente es personalizada (creada en Configuración) el UPDATE falla con error de enum y la lista no responde. También el `Select` queda vacío si `source_id` es null aunque haya `source` enum.

**Fix**:
- En `ContactInfoCard.tsx`: guardar **sólo** `source_id`. Eliminar el set de `source` enum.
- Mostrar como label el nombre del source resuelto desde `sources` por `sourceId`, con fallback a `contact.source` si no hay match.
- Migración: convertir `contacts.source` y `deals.source` de enum `lead_source` a `text` (no destructiva: `ALTER COLUMN ... TYPE text USING source::text`) para que cualquier fuente personalizada pueda persistirse. Mantener default `'Manual'`.

### 2) IA no crea fuentes (ni configuración) para tenant_owner / tenant_admin

**Causa**: `global-ai/index.ts` no expone tools de configuración. `ai-execute/index.ts` no maneja kinds para crear stages, sources, pipelines.

**Fix**:
- En `ai-execute/index.ts`: nuevos kinds `create_contact_source`, `create_contact_stage`, `create_pipeline_stage`. Validan rol del usuario (debe ser `tenant_admin` o `tenant_owner` vía `has_role`) antes de insertar. Devuelven preview con nombre/posición y ejecutan el insert con `tenant_id` del perfil.
- En `global-ai/index.ts`: añadir tools `propose_create_contact_source`, `propose_create_contact_stage`, `propose_create_pipeline_stage`. Sólo se exponen al modelo si el usuario es admin/owner (consulta `user_roles` al iniciar la conversación). Para vendedores, se omiten del array `tools`.
- Mensaje de sistema describe: "Si eres admin puedes proponer nuevas fuentes, etapas, etc.".

### 3) Dashboard y Reportes deben incluir actividad del contacto (tareas)

**Fix**:
- `useRecentActivity` (dashboard.ts): hacer dos queries en paralelo (`activities` + `tasks` con join a `contacts(name,last_name)`), mapear tasks como filas con `type:"task"`, ordenar por `occurred_at`/`due_at` desc y devolver el top N.
- En `Reports`: equivalente — pasar tasks al heatmap de actividad de equipo y a `TeamActivityHeatmap` / `SellerPerformanceTable` (sumar tasks completadas por vendedor en el período).

### 4) No se muestran todas las tareas + tareas con mismo nombre desaparecen

**Causas**:
- En `Tasks.tsx` el toggle **"Solo mías"** está activo por default (`useState(true)`) y filtra por `assignee_id = auth.user.id`. Las tareas seed y las creadas sin asignar no aparecen.
- En `useTasks` los views Hoy/Próximas/Vencidas requieren `due_at` (gte/lte). Tareas sin fecha no aparecen en ningún tab excepto "Todas".
- "Mismo nombre, distinto contacto sólo muestra 1": revisar render — la lista usa `key={t.id}` (único) así que no debería colapsar; el caso probable es que ambas tareas comparten misma fecha y el orden secundario causa que React Query las trate igual en algún memo. Añadiremos `key={t.id}` ya garantizado y test manual.

**Fix**:
- Default `mineOnly = false`.
- Mostrar tareas sin `due_at` en "Todas" y "Hoy/Próximas" tratándolas como sin fecha (sección aparte "Sin fecha").
- En cada item mostrar fecha absoluta + hora (`dd MMM, HH:mm`) y un **badge de estatus**: Vencida (rojo), Hoy (warning), Próxima (info), Completada (success).
- Verificar que la query no aplique distinct ni dedupe por título.

### 5) Editar tareas (en sección Tareas y dentro del contacto)

**Fix**:
- Refactorizar `QuickTaskDialog` para aceptar `task?: TaskRow` y entrar en modo edición: precarga título/fecha/asignado/contacto, hace UPDATE en lugar de INSERT.
- Añadir botón ✏️ junto al ✕ en cada fila de `Tasks.tsx` y `TasksTab.tsx` que abre el diálogo en modo edición.
- Añadir campo "Asignado a" (Select de `useTenantUsers`) en el diálogo.

### 6) IA en Resumen del contacto debe leer actividades del contacto + actividades de sus oportunidades

**Causa**: `contact-ai-suggest/index.ts` sólo carga `activities WHERE contact_id = X`. Las actividades ligadas al deal (con `deal_id` pero `contact_id` null) no entran.

**Fix**: en `contact-ai-suggest`, después de cargar los deals del contacto, hacer una query adicional `activities WHERE deal_id IN (deal_ids) AND contact_id IS NULL` y combinarlas con las del contacto en `activitySummary`. Etiquetar cada línea con `[contacto]` o `[oportunidad: <nombre>]` para que el modelo distinga.

---

### Archivos a editar

| Archivo | Cambio |
|---|---|
| `src/components/contacts/detail/ContactInfoCard.tsx` | Guardar sólo `source_id`; resolver label desde `sources` |
| `supabase/migrations/<new>.sql` | `ALTER COLUMN contacts.source / deals.source TYPE text` |
| `supabase/functions/ai-execute/index.ts` | Nuevos kinds: create_contact_source/stage, create_pipeline_stage |
| `supabase/functions/global-ai/index.ts` | Nuevos tools admin + filtrado por rol |
| `src/lib/queries/dashboard.ts` | `useRecentActivity` une activities + tasks |
| `src/components/reports/TeamActivityHeatmap.tsx` + queries de reports | Incluir tasks |
| `src/pages/app/Tasks.tsx` | mineOnly=false, fecha absoluta, badge estatus, botón editar, sección "Sin fecha" |
| `src/components/contacts/detail/TasksTab.tsx` | Mostrar fecha+hora+badge, botón editar |
| `src/components/pipeline/QuickTaskDialog.tsx` | Modo edición + Select asignado |
| `src/lib/queries/tasks.ts` | `useUpdateTask` mutation; ajuste de filtros para tareas sin due_at |
| `supabase/functions/contact-ai-suggest/index.ts` | Cargar activities de deals del contacto |

### Notas técnicas
- La migración a `text` para `source` es retrocompatible: los valores existentes ('Manual', 'WhatsApp', etc.) se preservan como strings. El enum `lead_source` queda sin uso pero no se elimina (otros componentes podrían referenciarlo).
- El check de rol en `global-ai` se hace una sola vez al inicio: `await supabase.from('user_roles').select('role').eq('user_id', userId)` y se calcula `isAdmin = roles.includes('tenant_admin'|'tenant_owner')`.
- Los recordatorios de IA por hora (cron) no se incluyen en este lote, ya están en el plan previo aprobado pendiente.