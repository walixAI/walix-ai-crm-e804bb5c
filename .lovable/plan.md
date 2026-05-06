# Correcciones sección Contactos (ronda 4)

## 1) IA sigue exigiendo teléfono al crear contacto

Quedaron dos lugares con `phone` obligatorio:

- **`supabase/functions/global-ai/index.ts`** (tool `propose_create_contact`, línea ~401): `required: ["name", "phone", "summary"]` → cambiar a `required: ["name", "summary"]`. Agregar en la `description` del tool: "Solo `name` es obligatorio".
- **`supabase/functions/ai-execute/index.ts`** (case `create_contact`, línea 346): quitar el chequeo `if (typeof p.phone !== "string" || !p.phone.trim()) return bad(400, "phone requerido")`. Insertar `phone` solo si viene como string no vacío.
- Reforzar el system prompt de `global-ai` (líneas 186-191): "Para crear un contacto basta el nombre. NUNCA pidas teléfono/email como obligatorios."

## 2) Vendedor por defecto = usuario logueado

- **`ai-execute` `create_contact`**: añadir `owner_id: userId` al objeto `ins` cuando no venga `owner_id` en el payload.
- **`ai-execute` `create_deal`** (consistencia): mismo patrón con `owner_id: userId`.
- **`contacts-ai-create/index.ts`**: ya pone `owner_id: user.id`; verificar que se mantenga.
- **`ContactFormDialog.tsx`**: inicializar `ownerId` en alta (no edición) con `user.id` desde `useAuth()` cuando el contacto es nuevo y `ownerId` está vacío. Mostrar el vendedor preseleccionado en el `Select`.
- **`QuickTaskDialog.tsx`** y **`LogActivityDialog`**: al crear la tarea/actividad, setear `assignee_id` / `agent_id = user.id` por defecto (hoy quedan en null).

## 3) Box "Próximas tareas" del detalle de contacto está hardcodeado

`src/components/contacts/detail/DealsSidePanel.tsx` líneas 37-58 contiene 2 tareas fijas ("Llamar para seguimiento", "Enviar contrato firmado"). Reemplazar por:

- Usar `useContactTasks(contactId)` (ya existe en `lib/queries/contacts.ts`).
- Filtrar `!completed`, ordenar por `due_at` ascendente, mostrar máximo 5.
- Por cada tarea: título, fecha relativa de vencimiento, color rojo si `due_at < now`, gris si no tiene fecha.
- Botón `+` abre `QuickTaskDialog` con `contactId`.
- Empty state: "Sin tareas pendientes".
- Pasar `contactId` como prop nueva al componente; actualizar `ContactDetail.tsx` (2 lugares: sheet móvil y aside desktop).

## 4) "Agendar llamada" desde Resumen no se refleja y aparece como vencida

Causa: El botón "Agendar llamada" en `SummaryTab.tsx` abre `QuickTaskDialog`, que crea una **tarea** (no una actividad) con `due_at = null`. Al no ser una actividad, no aparece en "Últimos eventos" ni en el feed de Actividades. Y como Francisco Ramírez tiene `last_activity_at` antiguo, alguna tarea anterior aparece como vencida.

Cambios:

- En `SummaryTab.tsx`:
  - Reemplazar `QuickTaskDialog` por `LogActivityDialog` con `kind="call"` para el botón "Agendar llamada" (registra inmediatamente una actividad tipo `call`).
  - Si el siguiente paso sugerido es de tipo `task`, abrir `LogActivityDialog` también con `kind="call"` (en lugar de tarea).
  - Mantener el estado `taskOpen` → renombrar a `logOpen`, y `taskTitle` → `defaultDescription`.
- Añadir prop opcional `defaultDescription` a `LogActivityDialog` para precargar el textarea.
- Verificar que `useCreateContactActivity` invalida `["contact-activity", contactId]` (ya lo hace) para refrescar la lista en Resumen + Actividades.
- Para los items en "Próximas tareas" del aside: marcar `vencida` solo si `due_at != null && due_at < now && !completed`. Sin `due_at`, mostrar "Sin fecha" en gris (no rojo).

## Archivos editados

- `supabase/functions/global-ai/index.ts`
- `supabase/functions/ai-execute/index.ts`
- `src/components/contacts/ContactFormDialog.tsx`
- `src/components/contacts/detail/DealsSidePanel.tsx`
- `src/components/contacts/detail/SummaryTab.tsx`
- `src/components/contacts/detail/dialogs/LogActivityDialog.tsx`
- `src/components/pipeline/QuickTaskDialog.tsx`
- `src/pages/app/ContactDetail.tsx` (pasar `contactId` a `DealsSidePanel`)

No se requieren cambios de base de datos.
