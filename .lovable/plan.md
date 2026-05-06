# Mejoras Contactos — Iteración 3

Atendemos los 8 puntos planteados y agregamos sugerencias de UX/CRUD para dejar la sección lista para uso operativo del vendedor.

---

## 1. Configuración tenant para Etapas y Fuentes (nuevo Tab "Contactos" en Configuración)

Hoy `lead_status` y `lead_source` son **enums de Postgres** (no editables sin migraciones). Los reemplazamos por **tablas por tenant**, lo que permite CRUD desde la UI y que todos los vendedores vean los cambios al instante.

**Backend (migración):**
- `contact_stages(id, tenant_id, name, color, position, is_default, is_won, is_lost, created_at)` — RLS por tenant; admin/owner edita, vendedor lee.
- `contact_sources(id, tenant_id, name, icon, position, created_at)` — misma RLS.
- En `contacts`: agregar `stage_id uuid` y `source_id uuid` (nullable inicial). Trigger de seed: al crear un tenant se insertan las 6 etapas y 4 fuentes actuales como defaults.
- Backfill: por cada contacto, mapear `status` (enum) → `stage_id` y `source` (enum) → `source_id` por nombre.
- Mantener columnas enum legacy un release (read-only) para no romper Kanban/Pipeline; en cuanto la UI use `stage_id`/`source_id`, se eliminan en una segunda migración.

**UI Settings → nuevo tab "Contactos":**
- `src/components/settings/contacts/ContactsSettingsTab.tsx` con dos secciones:
  - **Etapas**: lista drag-and-drop (`@dnd-kit`) con color, "ganada/perdida" toggle, renombrar, eliminar (con confirmación si hay contactos asignados → ofrece reasignar a otra etapa).
  - **Fuentes**: lista simple CRUD con icono opcional.
- Solo visible/editable para `tenant_owner` y `tenant_admin` (resto: vista de solo lectura).
- Añadir entrada `{ id: "contacts", label: "Contactos" }` en `Settings.tsx`.

**Hooks:** `useContactStages`, `useContactSources`, `useUpsertStage`, `useDeleteStage`, etc. Se reemplazan los usos de `ALL_LEAD_STATUSES` y `ALL_SOURCES` (badges, Kanban, ChangeStatusPopover, ContactInfoCard, ContactFormDialog, BulkActionsInline) por estas queries.

---

## 2. Alta: solo "Nombre" obligatorio

En `ContactFormDialog.tsx` quitar la validación de teléfono (`if (!editing && !phone.trim()) ...`). Conservar nombre obligatorio.
- Si no hay teléfono, ocultar el botón "Guardar y abrir WhatsApp".
- En la BD `contacts.phone` está `NOT NULL` → migración: hacerlo nullable.

---

## 3. Editar y eliminar eventos registrados (actividades)

**Migración:** `activities` no tiene `updated_at` → agregar columna + trigger `set_updated_at`.

**UI:** en cada item del timeline (en `ContactDetail` y nuevo sub-tab Actividades), mostrar menú "..." con **Editar** y **Eliminar** (solo el autor o admin).
- Componente `ActivityItem.tsx` con popover de edición inline (textarea + tipo + fecha/hora).
- Hooks: `useUpdateActivity`, `useDeleteActivity` en `lib/queries/contacts.ts`.

---

## 4. Registro de llamada con fecha/hora real + descripción + fecha de registro

Reemplazar el `ActivityComposer` actual (textarea simple) por un **dialog tipado** según el tipo elegido:
- `LogCallDialog`: fecha+hora de la llamada (datepicker shadcn + input `time`), duración (opcional), resultado (Conectó / No contestó / Buzón / Reagendar) y descripción.
- `LogMeetingDialog`: fecha+hora, lugar / link, asistentes, descripción.
- `LogEmailDialog`: asunto, dirección, descripción.
- `LogNoteDialog`: textarea + adjunto opcional (futuro).

Persistencia: usar `activities.occurred_at` (existente) para la fecha real y `created_at` (existente) para fecha de registro. Metadatos extra (duración, resultado, asunto) van en una nueva columna `activities.metadata jsonb` (migración).

El timeline muestra ambas fechas: "Llamada el 5 may 14:30 · registrada hace 2 h".

---

## 5. Fuente editable desde Configuración → ya cubierto en punto 1

`ContactInfoCard` y formularios consumen `useContactSources()` en lugar de `ALL_SOURCES`.

---

## 6. Popup pequeño para editar teléfono y correo

En `ContactInfoCard.tsx` reemplazar la edición inline de Email/Teléfono por **Popover** compacto con:
- Input grande (h-10), validación básica (regex email, dígitos teléfono con prefijo país).
- Botones "Guardar" / "Cancelar".
- Para teléfono: campo de país (🇲🇽 +52) + número, mismo estilo que el alta.

Quedan inline solo los campos cortos (Fuente, Asignado).

---

## 7. Empresas como tabla independiente

**Migración:**
- `companies(id, tenant_id, name, website, industry, size, phone, email, address, notes, owner_id, created_at, updated_at)` con RLS por tenant.
- Agregar `contacts.company_id uuid` (nullable). Backfill: crear company por nombre único existente y enlazar.
- Mantener `contacts.company` (texto) como cache denormalizado del nombre (para listas/CSV).

**UI:**
- `CompanyCard.tsx` se vuelve un selector (`Combobox`): buscar empresa existente o "+ Crear nueva" → mini-dialog con nombre, web, industria, tamaño.
- Hover sobre la empresa muestra acciones: "Ver empresa" (futuro detalle) / "Desvincular".
- Hooks: `useCompanies(search)`, `useCreateCompany`, `useUpdateCompany`.
- (Futuro fuera de este plan) página `/companies` con listado y detalle. Por ahora solo CRUD vía dialog.

---

## 8. Tabs centrales reorganizados: Resumen / Conversaciones / Actividades

**Estructura nueva en `ContactDetail.tsx`:**
```
Tabs principales: [Resumen] [Conversaciones (n)] [Actividades]

Dentro de "Actividades":
  Sub-tabs: [Todas] [Notas] [Llamadas] [Reuniones] [Emails] [Tareas]
  Cada sub-tab:
    - Botón "+ Nueva ___" arriba a la derecha (abre dialog tipado del punto 4)
    - Lista cronológica con CRUD (editar/eliminar — punto 3)
    - Vacío: empty-state con CTA
```

- Eliminar tabs sueltos actuales "Oportunidades", "Tareas", "Notas". Oportunidades queda en el panel derecho `DealsSidePanel`. Tareas y Notas se vuelven sub-tabs de Actividades.
- "Todas" combina notas + llamadas + reuniones + emails + tareas + eventos del sistema (mensajes WhatsApp, cambios de etapa) en un timeline unificado, con filtro por tipo en el header.
- Sub-tab "Tareas" mantiene `TasksTab.tsx` actual; sub-tab "Notas" mantiene `NotesTab.tsx`.
- Nuevos: `CallsTab.tsx`, `MeetingsTab.tsx`, `EmailsTab.tsx` — todos consumen `useContactActivity(id, { type })` filtrado.

---

## Mejoras adicionales sugeridas

1. **Atajos de teclado** en el detalle: `N` nueva nota, `L` registrar llamada, `T` nueva tarea, `M` reunión, `E` email, `W` abrir WhatsApp.
2. **Recordatorios automáticos**: al registrar una llamada con resultado "Reagendar", crear tarea automática con la fecha sugerida.
3. **Empresa enriquecida**: al crear una empresa, intentar autocompletar industria/tamaño desde el dominio del email del contacto (heurística simple, sin APIs externas en esta iteración).
4. **Validación de duplicados**: al alta, si el teléfono o email ya existen, mostrar banner "Ya existe un contacto con este dato → Ver" en vez de bloquear.
5. **Auditoría**: las ediciones/eliminaciones de actividades quedan en `audit_log` (tabla ya existente) para trazabilidad.
6. **Permisos**: vendedor solo edita/elimina sus propias actividades; admin/owner cualquiera.

---

## Sección técnica (resumen para implementación)

**Migraciones SQL (1 sola migración):**
- `contact_stages`, `contact_sources`, `companies` con RLS.
- `contacts`: agregar `stage_id`, `source_id`, `company_id`; hacer `phone` nullable.
- `activities`: agregar `updated_at` (con trigger) y `metadata jsonb`.
- Triggers: seed de stages/sources al crear tenant (extender `handle_new_user`).
- Backfill: poblar `stage_id`/`source_id`/`company_id` desde valores actuales.

**Archivos nuevos:**
- `src/components/settings/contacts/ContactsSettingsTab.tsx`, `StagesEditor.tsx`, `SourcesEditor.tsx`
- `src/components/contacts/detail/dialogs/LogCallDialog.tsx`, `LogMeetingDialog.tsx`, `LogEmailDialog.tsx`, `LogNoteDialog.tsx`
- `src/components/contacts/detail/ActivityItem.tsx` (con edit/delete)
- `src/components/contacts/detail/tabs/AllActivitiesTab.tsx`, `CallsTab.tsx`, `MeetingsTab.tsx`, `EmailsTab.tsx`
- `src/components/contacts/detail/EditPhoneEmailPopover.tsx`
- `src/components/contacts/detail/CompanyCombobox.tsx`, `CompanyQuickCreateDialog.tsx`
- `src/lib/queries/contactStages.ts`, `contactSources.ts`, `companies.ts`
- Hooks de update/delete activities en `contacts.ts`.

**Archivos modificados:**
- `src/pages/app/Settings.tsx` (+tab Contactos)
- `src/pages/app/ContactDetail.tsx` (3 tabs principales + sub-tabs)
- `src/components/contacts/ContactFormDialog.tsx` (solo nombre obligatorio)
- `src/components/contacts/detail/ContactInfoCard.tsx` (popover edit + sources dinámicas)
- `src/components/contacts/detail/CompanyCard.tsx` → reescrito con combobox
- `src/components/contacts/ChangeStatusPopover.tsx`, `ContactsKanban.tsx`, `BulkActionsInline.tsx` (consumen stages dinámicos)
- `src/lib/contacts/badges.ts` (statusBadgeClass derivado de color de la stage)

**Sin breaking changes** para usuarios: enums se mantienen una iteración, columnas legacy se eliminan después.

¿Procedo con la implementación?
