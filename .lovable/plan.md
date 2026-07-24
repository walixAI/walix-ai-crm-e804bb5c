
# Cierre inteligente de pendientes

Hoy en Mi Día un pendiente se cierra con un simple click en el ícono de check, sin verificar si realmente hubo contacto con el cliente. El objetivo es que "hecho" signifique **hecho de verdad**: hubo WhatsApp/email/llamada relacionado, o el usuario dejó evidencia explícita.

## Cómo se resuelve cada tipo de pendiente

Al pulsar "Marcar hecha" se abre un diálogo que **detecta automáticamente el canal** según el tipo de tarea (`task_kind`) y sugiere la acción más adecuada. No se cierra la tarea hasta que exista evidencia válida — con una excepción: llamadas (checkbox manual, no medibles).

**Reglas por canal:**

| Tipo pendiente | Cómo se cierra automáticamente | Fallback manual |
|---|---|---|
| WhatsApp (seguimiento, cobro, reactivación) | Se abre el composer con un **borrador contextual** ("Hola Ana, sigo pendiente de tu decisión sobre…"). Al enviarse, si el texto contiene ≥1 palabra clave relacionada al pendiente, se cierra sola. | "No pude contactar" → pide motivo + reagenda |
| Email (cobro, propuesta) | Igual que WhatsApp: borrador prellenado, envío desde Walix cierra la tarea si el asunto/cuerpo contiene keywords del pendiente. | "No pude contactar" |
| Llamada | **Checkbox visible obligatorio** con resultado (Contestó / No contestó / Buzón) + nota corta obligatoria de 1 línea con el próximo paso. | — |
| Otro (visita, tarea interna) | Nota obligatoria describiendo qué pasó. | — |

**Validación de "texto relacionado" para WhatsApp/email:** se extraen keywords del título del pendiente (ej. "Reactivar contacto Silva Catering" → `["silva", "catering", "reactivar"]` o para "Cobrar deal X" → `["pago", "cobro", "factura", nombre del deal]`) y el mensaje enviado debe contener al menos una. Si no, se muestra advertencia: *"Este mensaje no parece relacionado al pendiente. ¿Quieres cerrar la tarea de todos modos?"* con opción de "Editar mensaje" o "Sí, cerrar".

## Reagendar inteligente cuando no se resuelve

Si el usuario elige "No contestó / No respondió / Reagendar", el sistema propone la **fecha más pertinente** según contexto:

- **Cierre de mes cercano** (últimos 3 días hábiles del mes) + deal con `expected_close_date` este mes → **reintentar hoy en 2 horas**.
- **Deal en etapa "Negociación" o "Propuesta"** con `probability ≥ 70` → **mañana temprano** (9:00 hora local).
- **Deal en "Seguimiento"** o probabilidad media → **en 2 días**.
- **Contacto frío / sin deal activo** → **en 5 días**.
- **Cobro vencido** → **mañana mismo**, prioridad alta.

El usuario ve la sugerencia con 1 tap ("Reagendar mañana 9:00 ✓") y puede sobrescribir con un date picker.

## Detección automática de fondo (sin tocar el botón)

Un mecanismo pasivo cierra pendientes sin acción del usuario cuando:

- Se envía un WhatsApp desde Walix al contacto vinculado a la tarea **con texto relacionado** al pendiente (mismas keywords) **dentro de las 24 h siguientes** a la creación de la tarea → la tarea se marca `completed` automáticamente y aparece toast en Mi Día: *"Cerré 'Reactivar Silva Catering' porque enviaste WhatsApp"*.
- Se registra una llamada o email con el contacto vinculado en las mismas condiciones → igual auto-cierre.

Esto se hace del lado de la app (React Query invalidation + un hook que corre al enviar un mensaje/registrar actividad), no requiere edge function nueva.

## Feed de evidencia en el perfil del contacto

En `PendingList` cada tarea completada muestra un pequeño resumen bajo el título: *"Cerrada por WhatsApp · 18 jul, 10:30"* o *"Llamada — No contestó — Reagendada"*. Así el gestor y el gerente pueden auditar qué realmente ocurrió.

## Cambios técnicos

- **`CloseTaskDialog.tsx`**: reescrito para
  - Detectar canal sugerido a partir de `task.task_kind` (ya existe el campo).
  - Componer borrador de mensaje contextual (helper nuevo `buildDraftMessage(task, contact)`).
  - Validar keywords antes de cerrar cuando canal = WhatsApp/email.
  - Ofrecer bloque "Reagendar" con sugerencia calculada por `suggestReschedule(task, deal)`.
- **`src/lib/tasks/closure.ts`** (nuevo): utilidades puras
  - `extractKeywords(title)` — quita stopwords, devuelve tokens.
  - `messageMatchesTask(text, task, contact)` — booleano.
  - `suggestReschedule(task, deal, today)` — devuelve `{ date, reason }`.
- **`src/lib/queries/tasks.ts`**: nueva mutación `useRescheduleTask({ id, dueAt, reason })` que además crea una `activity` de tipo `note` con la razón.
- **`src/components/whatsapp/Composer.tsx`** / hook de envío: al enviar un mensaje, invocar `autoCloseRelatedTasks(contactId, text)` que consulta tareas abiertas del contacto y cierra las que hagan match por keywords.
- **`PendingList.tsx`** / `JumboColumn` en Mi Día: al cliquear el check en un pendiente que no sea llamada/otro, abre directamente `CloseTaskDialog` en modo canal detectado (ya lo hace en `PendingList`; falta hacerlo también en Mi Día — hoy Mi Día usa `onToggle` directo sin diálogo).
- **`tasks` schema**: agregar columnas opcionales `closed_via text` (`whatsapp` | `email` | `call` | `manual` | `auto`), `closed_note text`, `closed_at timestamptz`. Migración con GRANTs correspondientes.

## Fuera de alcance (para una fase siguiente)

- Integración con marcador telefónico nativo.
- Confirmación por respuesta del cliente ("se cierra cuando el cliente contesta"). Por ahora WhatsApp cuenta como hecho al enviar; el status de "esperando respuesta" queda para después.
- Aprendizaje por AI de qué reagenda funciona mejor (podemos alimentar `ai_outcome_feedback` con estos cierres para que el Aprendiz lo capture, pero sin cambios de UI).
