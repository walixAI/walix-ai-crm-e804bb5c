# Opción B — Sugerencias locales reales para el detalle de contacto

Reemplazar el contenido hardcodeado y los botones decorativos del bloque **"Próximo paso sugerido"** por sugerencias derivadas de datos reales del contacto, sin necesidad de llamar a IA. También cablear los dos botones que hoy no hacen nada y limpiar el `AiFloatingPanel` mockeado.

## Qué verá el usuario

- El bloque morado "Próximo paso sugerido" siempre mostrará una sugerencia útil basada en el estado real del contacto (último contacto, deals abiertos, mensajes WhatsApp pendientes, etc.), en lugar del texto genérico "Sin sugerencias activas…".
- El botón verde se adaptará a la sugerencia (ej. *"Reactivar conversación"*, *"Pedir confirmación de cotización"*, *"Responder mensaje pendiente"*).
- El botón **"Agendar llamada"** abrirá un diálogo para crear una tarea con fecha/hora.
- El botón **"Otra sugerencia"** rotará entre las heurísticas disponibles (ya no será decorativo).
- El globito flotante con IA (esquina inferior derecha) dejará de mostrar texto inventado: usará la misma sugerencia activa o se ocultará si no hay nada relevante.

## Heurísticas que se aplicarán (en orden de prioridad)

1. **Mensaje WhatsApp entrante sin responder** → "Responde el último mensaje de {nombre} (hace {X})". CTA: *Responder en WhatsApp*.
2. **Deal abierto con `expected_close_date` vencida o < 3 días** → "El deal '{nombre}' cierra pronto. Confirma siguiente paso." CTA: *Enviar recordatorio*.
3. **Sin actividad en 7+ días y status ∈ {Nuevo, Contactado, Calificado}** → "Han pasado {N} días sin contacto. Reactiva la conversación." CTA: *Reactivar por WhatsApp*.
4. **Contacto creado hace < 24 h y sin actividad** → "Da la bienvenida a {nombre} con un primer mensaje." CTA: *Enviar bienvenida*.
5. **Status = Ganado sin actividad reciente** → "Pide referidos o feedback a {nombre}." CTA: *Enviar mensaje*.
6. **Fallback** (todo en orden) → "Todo al día con {nombre}. Considera agendar un follow-up." CTA: *Agendar llamada*.

Cada sugerencia incluirá `id` estable, `text`, `cta` y un `action` (`whatsapp` | `task`) para que el componente sepa qué hacer al hacer click.

## Cambios técnicos

### 1. Nuevo módulo `src/lib/contacts/suggestions.ts`
- Función `buildContactSuggestions({ contact, activity, deals, lastInbound })` que retorna `Suggestion[]` aplicando las reglas de arriba.
- Tipo:
  ```ts
  type Suggestion = {
    id: string;
    text: string;
    cta: string;
    action: "whatsapp" | "task";
    priority: number;
  };
  ```
- 100% sincrónico, sin red, fácil de testear.

### 2. Hook `useContactSuggestions(contactId)` en `src/lib/queries/contacts.ts`
- Combina:
  - `useContact(contactId)` (ya existe).
  - `useContactDeals(contactId)` (ya existe).
  - `useContactActivity(contactId)` (ya existe).
  - Nueva mini-query: último mensaje **inbound** del contacto desde `messages` (join vía `conversations.contact_id`).
- Devuelve `Suggestion[]` ordenadas por prioridad. Reemplaza a `useContactAiSuggestions` en `SummaryTab` (la antigua se conserva por si se reusa en otro lado).

### 3. `SummaryTab.tsx`
- Estado local `index` para rotar sugerencias con "Otra sugerencia" (`(index + 1) % suggestions.length`).
- Botón verde dispara `onWhatsApp()` si `action === "whatsapp"`, o abre `QuickTaskDialog` si `action === "task"`.
- "Agendar llamada" → abre `QuickTaskDialog` con título prellenado *"Llamar a {nombre}"*.
- "Otra sugerencia" → solo visible si hay >1 sugerencia; rota el índice.
- Eliminar el branch *"Sin sugerencias activas…"* (siempre habrá fallback).

### 4. `QuickTaskDialog` — pequeña adaptación
- Hoy requiere `deal: PipelineDeal`. Hacer `deal` opcional y aceptar `contactId?: string` + `defaultTitle?: string` para poder crear tareas asociadas solo al contacto.
- Si no hay deal, insertar `tasks` con `deal_id: null` y `contact_id: contactId`.

### 5. `AiFloatingPanel.tsx` — limpieza
- Eliminar el texto "Han pasado 3 días…" hardcodeado y la lista de historial inventada.
- Mostrar la **sugerencia top** real (vía `useContactSuggestions`) y un máximo de 2 sugerencias secundarias como historial.
- Si `suggestions.length === 0`, ocultar todo el componente (no renderizar el FAB).

### 6. (Opcional, recomendado) test unitario
- `src/lib/contacts/suggestions.test.ts` con 4-5 casos cubriendo cada heurística para evitar regresiones.

## Lo que NO cambia

- No se crea Edge Function nueva, no se consume Lovable AI, no hay costo adicional.
- La tabla `ai_suggestions` se sigue usando para deals/dashboard; solo deja de ser fuente para contactos.
- El layout, colores y estilo del bloque "Próximo paso sugerido" se mantienen idénticos.

## Resultado esperado

El bloque deja de ser un placeholder y se convierte en un asistente útil que siempre tiene algo accionable que decir, con los 3 botones funcionando de verdad. Si más adelante quieres pasar a IA real (Opción A), el contrato `Suggestion[]` queda listo para ser alimentado por una edge function sin tocar la UI.
