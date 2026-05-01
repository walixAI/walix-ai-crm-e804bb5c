# Mejoras de prioridad media — Walix.ai

Tres mejoras independientes en el agente conversacional. Sin cambios de DB.

---

## 1. Retomar conversaciones del historial (#7)

**Problema actual:** El sidebar de "Historial reciente" solo guarda el primer turn de cada conversación. Al hacer click se dispara `ask(q.prompt)` que envía solo el prompt sin restaurar el hilo previo.

**Solución:** Persistir conversaciones completas (todos los turns) y permitir restaurarlas.

### Cambios

**`src/store/aiDrawer.ts`**
- Cambiar el shape persistido: en lugar de `AiQuery[]` (turns sueltos) guardar `Conversation[]` donde `Conversation = { id, title, turns: AiQuery[], updatedAt }`. Title = primer prompt truncado a 60 chars.
- Nueva acción `resumeConversation(id)`: carga `turns` completos al estado activo y deja `current` en el último turn.
- En `ask()`: cuando es el primer turn de una conversación nueva, crear la `Conversation` y persistirla. En turns subsecuentes, hacer upsert (actualizar `turns` y `updatedAt` de la misma conversación). Mantener máx 5 conversaciones.
- Migración suave: al cargar, si encuentra el shape antiguo (`AiQuery[]`) lo convierte a `Conversation[]` con un solo turn cada uno (key `walix.aiDrawer.history.v2`).

**`src/components/walix/AiDrawer.tsx`**
- Cambiar la lista del empty state: cada item del historial muestra título + cantidad de turns + timestamp relativo. Click llama a `resumeConversation(id)` en vez de `ask(prompt)`.
- "Nueva" sigue funcionando (`clearConversation`) y al enviar el siguiente prompt arranca una nueva entrada.

---

## 2. Botón "Copiar respuesta" (#9)

**Cambio:** En `AiDrawer.tsx`, junto a los botones de feedback (👍/👎) del último turn, agregar un botón ícono `Copy` (lucide-react) que copie `turn.answer` al clipboard usando `navigator.clipboard.writeText()`. Estado visual: ícono cambia a `Check` por 1.5s tras copiar. Toast opcional: "Copiado al portapapeles".

Ubicación: dentro del bloque de feedback (línea ~470 aprox), antes o después de los thumbs.

---

## 3. Tool `propose_send_whatsapp_message` (#12)

**Alcance:** Esta es una **propuesta interna** (no envío real a Meta WhatsApp Cloud API). Cuando se confirma:
1. Inserta una row en `messages` con `direction='outbound'`, `type='text'`, `body=<texto>`, `is_internal_note=false`.
2. Actualiza `conversations.last_message_at = now()` y `conversations.preview = body.slice(0,80)`.
3. Inserta una `activities` row tipo `wa_sent` con descripción.
4. Marcador en `metadata` de la row de `messages`: `{ source: "ai_drawer_proposal" }`.

Esto deja todo trazado y visible en la UI de WhatsApp existente, sin pretender que se entregó por la red. (Cuando exista integración real de WA Cloud API, se reemplaza solo el handler de execute.)

### Cambios

**`supabase/functions/global-ai/index.ts`**
- Agregar tool `propose_send_whatsapp_message` con params: `conversation_id` (uuid, requerido), `contact_id` (uuid, opcional para fallback de búsqueda), `body` (string 1–1000 chars, requerido), `summary`, `reasoning`.
- Mapear en `KIND_MAP`: `propose_send_whatsapp_message → send_whatsapp_message`.
- Catálogo extendido de conversaciones (ya está) + regla en system prompt: "Cuando el usuario pida enviar/responder WhatsApp a alguien, busca la conversación abierta con ese contacto. Si no existe, llama a `search_entity` kind='convo'. NO inventes texto: si el usuario no da el mensaje exacto, propón un borrador breve y menciona en `reasoning` que es un draft editable."

**`src/services/ai.ts`**
- Agregar `"send_whatsapp_message"` al union `ProposalKind`.

**`supabase/functions/ai-execute/index.ts`**
- **Preview** handler: valida `conversation_id` (uuid) y `body` (1–1000 chars). Devuelve `before: { Último mensaje: <preview actual> }`, `after: { Mensaje saliente: body, Para: <contact name> }`.
- **Execute** handler: tx en 3 pasos (insert message, update conversation, insert activity). Requiere que la conversation pertenezca al tenant (RLS lo valida).
- Validación: rechazar si la conversation está `Cerrado`.

**`src/components/walix/AiDrawer.tsx`**
- Agregar caso al `proposalIcon`: `send_whatsapp_message → MessageCircle`.
- Agregar invalidación: `["whatsapp"]`, `["conversations"]`, `["messages"]` en `invalidateForKind`.
- En el editor inline de payload (la sección "Pencil"), permitir editar el `body` del mensaje como textarea.

---

## Sin tocar

- DB schema (todo usa tablas existentes: `messages`, `conversations`, `activities`).
- RLS (las políticas tenant-scoped ya cubren los inserts/updates).
- Auth flow.
- Plan/limits.

## Orden de implementación

1. WhatsApp tool (backend + frontend) — el más mecánico.
2. Botón Copiar — 1 archivo, 5 min.
3. Retomar conversaciones — el más invasivo (cambio de shape persistido + UI del historial).

¿Procedo?
