# Crear Actividad, Notas y Tareas en el contacto

Actualmente, dentro de cada contacto:
- **Actividad**: solo lectura (timeline).
- **Notas**: pestaña vacía con un botón "Agregar nota" que no hace nada.
- **Tareas**: la pestaña no existe (aunque la tabla `tasks` y el tipo `task` en `activities` ya existen).

El objetivo es que las tres se puedan crear desde la **UI del contacto**, desde la **IA** (drawer/sugerencias) y desde la pantalla de **WhatsApp**.

---

## 1. UI dentro del contacto (`ContactDetail.tsx`)

### a. Nueva pestaña "Tareas"
Agregar `<TabsTrigger value="tasks">Tareas</TabsTrigger>` con badge de cantidad (pendientes). Lista de tareas del contacto:
- Checkbox para marcar completada (update `tasks.completed`).
- Título, fecha de vencimiento (badge rojo si vencida), responsable.
- Botón **"Nueva tarea"** que abre el `QuickTaskDialog` ya existente (acepta `contactId` sin deal). Ya está implementado para este caso.

Nuevo hook `useContactTasks(contactId)` en `src/lib/queries/contacts.ts` (SELECT en `tasks` filtrando por `contact_id`).

### b. Pestaña "Notas" funcional
Reemplazar el placeholder por:
- Composer arriba (Textarea + botón "Guardar nota") — inserta en `activities` con `type='note'`, `description=texto`, `agent_id=auth.uid()`.
- Lista debajo: `useContactActivity` filtrada por `type='note'`, con avatar del autor y tiempo relativo. Permitir borrar nota propia.

### c. Pestaña "Actividad" con composer
Mantener el timeline actual (todos los tipos) y agregar arriba un mini-composer:
- Selector de tipo: `Llamada` / `Reunión` / `Email` / `Nota` / `Otro` (mapeados a `note` por ahora, distinguidos en `description` con prefijo o usando `metadata` — pero como el enum solo tiene `wa_*, note, deal, task`, todas las manuales caen en `note` con un prefijo "[Llamada] ...").
- Textarea + botón "Registrar".

Alternativa más limpia: extender el enum `activity_type` con `call`, `meeting`, `email`, `manual` (migración). **Recomendado**: hacer la migración para no abusar de `note`.

### d. Refresco
Tras cualquier creación, invalidar `["contact-activity", id]`, `["contact-tasks", id]`, `["contact-stats", id]`.

---

## 2. Crear desde la IA

El `AiFloatingPanel` / `AiDrawer` ya invoca `ai-execute`, que **ya soporta** `create_task` y `create_activity`. Falta:

- **Mejorar el prompt** de `contact-ai-suggest` y del drawer de IA para que, además de sugerir un mensaje WhatsApp, pueda proponer:
  - "Registrar nota: …" → propone `create_activity` con `type='note'`.
  - "Crear tarea: …" → propone `create_task`.
- En la UI del drawer, al recibir una propuesta de tipo `create_activity` o `create_task`, mostrar el botón "Registrar" / "Crear tarea" que ya dispara el flujo preview → execute existente.
- Pasar `contact_id` actual como contexto por defecto (ya disponible en el drawer).

No requiere nuevas funciones edge — solo ajustar prompts y el panel para reconocer y renderizar estas dos acciones.

---

## 3. Crear desde WhatsApp

Hoy `whatsapp-ai` solo lee (sugerir / resumir). Hay que extenderlo o apoyarse en `ai-execute`.

### Cambios:
- **`ContactSidePanel.tsx`** (panel derecho del chat de WhatsApp): agregar dos secciones nuevas:
  - **Notas del contacto**: composer + últimas 5 notas (`activities` `type='note'`). Inserta como nota del contacto, no como `internal_notes` del chat.
  - **Tareas**: lista compacta + botón "Nueva tarea" que abre `QuickTaskDialog` con `contactId` y opcionalmente `deal_id` si la conversación tiene uno vinculado.
- **AI desde WhatsApp**: en `AiDrawer` del chat, agregar acciones rápidas:
  - "Crear tarea de seguimiento" → llama `ai-execute` (`create_task`) con título derivado del último mensaje.
  - "Guardar resumen como nota" → toma el resumen ya generado por `whatsapp-ai` (`mode=summarize`) y lo persiste con `create_activity` (`type='note'`).

Reutiliza la infraestructura existente; no se necesita una nueva edge function.

---

## 4. Cambios técnicos resumidos

### Migración (opcional pero recomendada)
```sql
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'call';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'manual';
```

### Archivos nuevos
- `src/components/contacts/detail/NotesTab.tsx`
- `src/components/contacts/detail/TasksTab.tsx`
- `src/components/contacts/detail/ActivityComposer.tsx`

### Archivos modificados
- `src/pages/app/ContactDetail.tsx` — agregar tab Tareas, montar nuevos componentes.
- `src/lib/queries/contacts.ts` — `useContactTasks`, `useCreateActivity`, `useCreateNote`, `useToggleTask`.
- `src/components/contacts/detail/AiFloatingPanel.tsx` — render de propuestas `create_activity` / `create_task`.
- `supabase/functions/contact-ai-suggest/index.ts` — añadir tipos de acción `note` y `task` con validación.
- `src/components/whatsapp/ContactSidePanel.tsx` — secciones Notas y Tareas.
- `src/components/whatsapp/AiDrawer.tsx` — acciones rápidas "Crear tarea" / "Guardar como nota".

### Sin cambios
- `ai-execute` ya soporta `create_task` y `create_activity`.
- RLS de `tasks` y `activities` ya permite insert por tenant.

---

## 5. UX y validaciones

- Composer de nota: máx 2000 chars, requiere texto no vacío.
- Tarea: título obligatorio (1-120), fecha opcional (datetime-local).
- Toasts de éxito/error consistentes con el resto de la app.
- Tras crear, refrescar tabs y `ContactStatsBar` (`last_activity_at`).
- Las acciones de IA pasan siempre por **preview → confirmar → execute** (ya implementado), nunca ejecutan automáticamente.

¿Procedo con esta implementación, incluyendo la migración del enum para tipos de actividad?