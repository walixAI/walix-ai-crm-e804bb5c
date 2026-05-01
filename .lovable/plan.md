# Sprint Walix.ai Fase 2A — Agente más útil, transparente y editable

Este sprint mejora 7 aspectos del módulo IA sin tocar la arquitectura base (agente + human-in-the-loop + auditoría). Foco: **percepción de "agente real"** y **menos fricción** al confirmar acciones.

## Alcance

```text
Quick wins
  #1   Placeholders dinámicos + chip beta en TopBar
  #14  Contexto de página actual (route + entidad seleccionada)
  #15  Mejor UX de fallback (separar error vs demo, retry)
  #25  Modo "explicar por qué"

Mejoras core del flujo de propuestas
  #3   Diff visual antes → después en cada propuesta
  #4   Editar propuesta inline antes de confirmar
  #13  Tool search_entity para encontrar deals/contactos fuera del top-N
```

Sin cambios de schema. Sin nuevas tablas. Cambios concentrados en `global-ai`, `ai-execute`, `AiDrawer`, `TopBar`, `services/ai.ts` y `store/aiDrawer.ts`.

---

## #1 — Placeholders dinámicos + chip "Beta agente" (TopBar)

**Qué cambia (`src/components/layout/TopBar.tsx`):**
- Reemplazar el placeholder estático por un array rotando cada 4s con ejemplos mezclados:
  - Consultas: *"¿Qué deals están en riesgo?"*
  - Acciones: *"Mueve Acme a Negociación"*, *"Crea tarea: llamar a Pedro mañana 10am"*
  - Contacto: *"Agrega a María Pérez, tel 5551234567"*
  - WhatsApp futuro: *"Resume la conversación con Carlos"*
- Añadir chip pequeño a la izquierda del input: `✨ Agente · Beta` con tooltip "Puedo ejecutar acciones con tu confirmación".
- Microcopy debajo del dropdown de sugerencias: *"También puedo crear, mover y actualizar — siempre te pido confirmar."*
- Pausar la rotación cuando el input está enfocado o tiene texto.

**Por qué:** hoy el placeholder sugiere solo lectura; los usuarios no descubren la capacidad ejecutora.

---

## #14 — Contexto de página actual

**Qué cambia:**
- `src/store/aiDrawer.ts`: `ask()` acepta y envía un `context` opcional con `{ route, entityType?, entityId?, entityLabel? }`.
- Capturar contexto desde `window.location.pathname` + parsing simple de query/path:
  - `/pipeline?dealId=X` → `{ entityType: "deal", entityId: X }`
  - `/contacts/X` → `{ entityType: "contact", entityId: X }`
  - `/whatsapp?conversationId=X` → `{ entityType: "convo", entityId: X }`
- `supabase/functions/global-ai/index.ts`: leer `context` del body y, si hay entidad, hacer un `select` extra para inyectar al prompt:

```text
## Contexto de la página actual del usuario
El usuario está viendo: deal "Acme Corp" (id: <uuid>)
  · Etapa: Negociación · Monto: $50,000 · Probabilidad: 70%
  · Última actividad: hace 3 días
Si el usuario usa pronombres ("súbele", "muévelo", "ciérralo"), asume que se refiere a esta entidad.
```

- También añadir el ID al catálogo aunque no esté en el top-N.

**Por qué:** transforma "súbele a 80k" de un fallo silencioso a una acción precisa.

---

## #15 — Mejor UX de fallback + retry automático

**Qué cambia:**

`src/services/ai.ts`:
- Añadir 1 reintento con backoff 800ms si `error.status === 429` o sin respuesta (red).
- Diferenciar dos estados de retorno: `source: "live" | "error" | "fallback"`.
  - `error`: el servicio falló → mostrar UI de error con botón Reintentar.
  - `fallback`: usado solo cuando intencionalmente devolvemos contenido demo (no en `askAi`).
- En `askAi` actual, eliminar el "fallback de demo" y devolver `source: "error"` con `errorMessage`.

`src/components/walix/AiDrawer.tsx`:
- Cuando `source === "error"`: reemplazar el banner amarillo "demo" por un card rojo claro:
  ```text
  ⚠️  No pude conectar con el servicio de IA
  [Reintentar]   [Cerrar]
  ```
- El card del prompt del usuario sigue visible para que reintente sin reescribir.

**Por qué:** hoy el banner "Respuesta de demostración" engaña — la IA no respondió, no es una demo.

---

## #25 — Modo "explicar por qué"

**Qué cambia:**

`global-ai`: cada `propose_*` recibe un nuevo campo opcional `reasoning` (string corto, máx 200 chars) que el modelo llena explicando qué señales del CRM motivaron la propuesta. El system prompt instruye:
> "Para cada `propose_*`, incluye `reasoning` con 1-2 frases sobre qué datos del contexto motivaron la propuesta (etapa, días sin actividad, monto, etc.)."

`AiDrawer.tsx`: cada card de propuesta añade un botón secundario `¿Por qué?` (icono `Lightbulb`) que toggle muestra:
```text
💡 Acme lleva 12 días sin actividad y la conversación pidió cierre.
```

**Por qué:** aumenta confianza para confirmar sin revisar todo el CRM manualmente.

---

## #3 — Diff visual antes → después

**Qué cambia:**

`supabase/functions/ai-execute/index.ts` (y la lógica de previsualización):
- Nueva acción/endpoint mínimo `preview` dentro de `ai-execute` (param `mode: "preview" | "execute"`, default `execute`):
  - `preview` lee el estado actual del registro afectado y devuelve `{ before: {...}, after: {...} }` sin escribir.
- Llamado automáticamente al renderizar la propuesta por primera vez.

`AiDrawer.tsx`: tras recibir el preview, debajo del summary se renderiza una mini-tabla:
```text
Monto         $50,000  →  $75,000
Probabilidad     70%   →    85%
Etapa     Negociación  →  Cerrado ganado
```
- Solo campos que cambian. Valores idénticos se omiten.
- Para `create_*`: mostrar tabla simple "Nuevo registro" con los campos rellenados.
- Para `mark_deal_lost`: mostrar `lost_reason` y `lost_comment` destacados.

**Por qué:** Confirmar a ciegas es riesgoso; el diff convierte la propuesta en una decisión informada.

---

## #4 — Editar propuesta inline antes de confirmar

**Qué cambia:**

`AiDrawer.tsx`:
- Tercer botón en cada card: `Editar` (icono `Pencil`).
- Al hacer click, el card se expande con un mini-form generado por `kind`:
  - `update_deal_amount`: inputs numéricos `amount`, `probability`.
  - `update_deal_stage`: `Select` con etapas del catálogo.
  - `create_task`: `title`, `due_at` (date+time picker), opcional `assignee`.
  - `create_contact` / `update_contact`: `name`, `last_name`, `phone`, `email`, `company`, `position`, `status`, `tags`.
  - `create_activity`: `type` select, `description` textarea.
  - `mark_deal_lost`: `lost_reason` (select con razones del tenant si existen) + `lost_comment` textarea.
- Al guardar la edición, se actualiza `payload` localmente y se re-llama `preview` para refrescar el diff.
- Botones del modo edición: `Aplicar cambios` / `Cancelar`.

`global-ai` system prompt: indicar que el usuario puede editar antes de confirmar, así que las propuestas pueden ser aproximadas si falta info (ej. monto sugerido pero el usuario lo ajustará).

**Por qué:** elimina el ciclo "descartar → reescribir prompt completo" cuando solo cambia un valor.

---

## #13 — Tool `search_entity`

**Qué cambia:**

`global-ai`: nueva tool function disponible para el modelo:
```text
search_entity({
  kind: "deal" | "contact" | "convo",
  query: string  // nombre, teléfono o email parcial
})
```

Implementación en el edge function:
- Cuando el modelo invoque esta tool, ejecutamos en Supabase (RLS-scoped):
  - `deal`: `select id, name, stage_name, amount from deals where name ilike '%query%' limit 5`
  - `contact`: `select id, name, last_name, company, phone from contacts where name ilike '%query%' or last_name ilike '%query%' or phone ilike '%query%' or email ilike '%query%' limit 5`
  - `convo`: join contacts → `select id from conversations where contact.name ilike '%query%' limit 5`
- Devolvemos los resultados al modelo en un nuevo turno (multi-turn tool calling) y el modelo continúa con la propuesta.

System prompt:
> "Si el usuario menciona un deal/contacto que no aparece en el catálogo, NO inventes el ID. Llama primero a `search_entity` para encontrarlo. Si hay múltiples resultados, pide al usuario que confirme cuál."

**Por qué:** desbloquea el caso "actualiza a Pedro García" cuando Pedro no está en los top 15.

---

## Cambios técnicos (resumen por archivo)

```text
src/components/layout/TopBar.tsx
  + array PLACEHOLDERS, useEffect rotación, chip beta, microcopy
  + captura de contexto de página al disparar ask()

src/store/aiDrawer.ts
  + AiQuery.context, source incluye "error", errorMessage, retry()
  + ask() acepta context y lo propaga

src/services/ai.ts
  + AskAiResult.source: "live" | "error"
  + askAi() retry 1x con backoff
  + previewProposal() → llama ai-execute con mode=preview
  + ProposedChange.reasoning, ProposedChange.before/after (cliente)

src/components/walix/AiDrawer.tsx
  + Banner de error con Reintentar
  + Card propuesta:
      - botón "¿Por qué?" (reasoning collapsible)
      - tabla diff before→after
      - botón Editar + form dinámico por kind
      - re-preview al editar

supabase/functions/global-ai/index.ts
  + lee body.context, inyecta entidad activa al prompt
  + tool search_entity con loop multi-turn
  + cada propose_* añade `reasoning` opcional
  + system prompt actualizado (contexto, edición, search)

supabase/functions/ai-execute/index.ts
  + mode "preview" | "execute"
  + en preview: select del registro actual, devuelve { before, after } sin escribir
  + sin cambios en audit_log
```

---

## Seguridad y validación

- `search_entity` corre con JWT del usuario → RLS aplica, no se filtran entidades cross-tenant.
- `ai-execute mode=preview` no escribe, no audita; mismas validaciones de UUID y catálogo.
- Edición inline pasa por la misma validación Zod del backend al confirmar — el frontend no es la única defensa.
- `reasoning` se sanea (máx 300 chars, sin HTML).
- El reintento de `askAi` se limita a 1 intento para no quemar créditos.

---

## Fuera de alcance (siguiente sprint)

- Streaming SSE (#6)
- Persistir threads server-side (#5)
- Bulk actions (#9)
- Undo / snapshot before en `audit_log` (#10, #18)
- Tools compartidas con WhatsApp (#11)
- Memoria de preferencias (#12)
- Telemetría `ai_events` (#20)

---

## Validación QA

Casos a probar tras implementar:
1. *"¿Qué deals están en riesgo?"* → respuesta normal, sin propuestas, source=live.
2. Estando en `/pipeline?dealId=X`: *"súbele el monto a 100k"* → propuesta correcta sobre ese deal sin necesidad de nombrarlo.
3. *"actualiza a Pedro García a status Calificado"* (Pedro fuera de top-15) → modelo invoca `search_entity`, propone update con ID correcto.
4. Click en `Editar` sobre propuesta de tarea → cambia título y fecha → diff se actualiza → confirma.
5. Click en `¿Por qué?` → muestra reasoning del modelo.
6. Apagar gateway (simular 500) → banner rojo con Reintentar, no el banner amarillo.
7. Confirmar `update_deal_amount` editado → `audit_log` registra el `payload` final (editado), no el original.
