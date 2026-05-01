
# Walix.ai — Crear deals + drawer conversacional

Dos arreglos que se complementan: agregar la capacidad faltante de crear deals, y convertir el drawer en un chat real para que el usuario pueda responder a las preguntas de la IA sin perder el hilo.

---

## 1. Nueva herramienta `propose_create_deal`

**Problema:** La IA no tiene cómo proponer la creación de un deal, así que ante "crea deal de 50000…" termina pidiendo datos en un bucle.

**Backend (`global-ai/index.ts`):**
- Agregar tool `propose_create_deal` con parámetros: `name` (req), `amount` (req), `contact_id` (opcional), `contact_name` (opcional, para mostrar en el summary), `stage_id` (opcional, default = primera etapa), `probability` (opcional), `expected_close_date` (opcional ISO), `summary`, `reasoning`.
- Mapear en `KIND_MAP` → `create_deal`.
- Ajustar el system prompt: si el usuario pide crear un deal y menciona un nombre que aparece en el catálogo de contactos, usar ese `contact_id` directamente; si no aparece, llamar primero a `search_entity` (kind=contact); si no hay match claro, **proponer el deal sin contact_id** y mencionar en `reasoning` que conviene vincular un contacto después. NO pedir aclaraciones a menos que haya >1 candidato exacto.

**Backend (`ai-execute/index.ts`):**
- Agregar `kind: "create_deal"` al type union.
- **Modo `preview`:** devolver `before=null`, `after={ Nombre, Monto, Contacto, Etapa, Probabilidad, "Cierre esperado" }`.
- **Modo `execute`:** validar `name` y `amount>0`. Si no viene `stage_id`, hacer fallback a la primera etapa del tenant (`pipeline_stages` ordenado por `position`). Insertar en `deals` con `tenant_id`, `name`, `amount`, `contact_id?`, `stage_id`, `stage_name`, `probability` (default según stage o 10), `expected_close_date?`. Devolver `target_type=deal`, `target_id=<uuid>`.

**Frontend (`AiDrawer.tsx`):**
- Añadir `"create_deal"` al `ProposalKind` type (en `services/ai.ts`), con icono `KanbanSquare` y un caso en `ProposalEditForm` con campos editables: nombre, monto, probabilidad, fecha de cierre y un Select de etapas (reusando `useStages()`). El `contact_id` se muestra como texto readonly con el nombre del contacto enlazado.
- Invalidar `["deals"]` y `["pipeline"]` tras ejecutar.

## 2. Drawer conversacional

**Problema:** Cuando la IA pregunta algo, no hay caja de texto para responder. El usuario tiene que cerrar el drawer y escribir desde el TopBar, lo que rompe el hilo de la conversación.

**Estado (`store/aiDrawer.ts`):**
- Reemplazar `current: AiQuery | null` por `turns: AiQuery[]` (array creciente para la conversación activa).
- `ask(prompt, ctx)` agrega un nuevo turno; ya envía el `history` con los últimos turnos al edge function (manda los últimos 6 mensajes alternando user/assistant).
- Añadir `clearConversation()` que vacía `turns` para empezar un chat nuevo. El `history` (la lista del lado derecho con preguntas pasadas) sigue funcionando: cada vez que se inicia una nueva conversación, el primer prompt se guarda ahí.
- Mantener el comportamiento de cerrar/abrir drawer sin perder los turnos hasta que el usuario haga "Nueva conversación".

**UI (`AiDrawer.tsx`):**
- Renderizar `turns` en lista vertical: cada turno = burbuja de usuario (gris a la derecha) + burbuja de IA (con `prose`, acciones y propuestas).
- En el footer del drawer, **siempre visible** cuando hay al menos un turno: un `<Textarea>` + botón enviar (Cmd/Ctrl+Enter) para responder. Al enviar, llama a `ask()` con el contexto actual y se agrega el nuevo turno al final.
- Auto-scroll al fondo cuando se agrega un turno o llega respuesta.
- Botón "Nueva conversación" en el header para limpiar `turns`.
- Las propuestas siguen apareciendo solo en su turno; al confirmar/descartar/editar funcionan como hoy.

**Edge function:**
- Ya recibe `history` — solo aumentar `slice(-4)` a `slice(-6)` para dar más contexto cuando hay seguimientos.

---

## Archivos a tocar

| Archivo | Cambios |
|---|---|
| `supabase/functions/global-ai/index.ts` | Tool `propose_create_deal`, ajuste de prompt para no pedir aclaraciones innecesarias, history `slice(-6)` |
| `supabase/functions/ai-execute/index.ts` | Handler `create_deal` (preview + execute) |
| `src/services/ai.ts` | `ProposalKind` += `"create_deal"` |
| `src/store/aiDrawer.ts` | `turns[]` + `clearConversation()` + envío de followups |
| `src/components/walix/AiDrawer.tsx` | Render multi-turno, footer con textarea siempre visible, botón "Nueva conversación", caso `create_deal` en ProposalEditForm + icon |

## Verificación

1. "crea deal de 50000 asociado a Juan gonzalez" → propone un deal con monto 50000, vinculado al Juan más probable (o sin contacto si no hay match), con tarjeta editable y botón Confirmar.
2. Si la IA pregunta algo, escribir la respuesta en el textarea del drawer → continúa el hilo en el mismo panel.
3. Botón "Nueva conversación" limpia el chat sin cerrar el drawer.

Sin migraciones de DB. Sin nuevas dependencias.
