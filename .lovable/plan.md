
# Walix.ai — Mejoras de alta prioridad

Cuatro arreglos enfocados que cierran los huecos más visibles del flujo conversacional + agente ejecutor.

---

## 1. Composer siempre disponible (incluido estado de error)

**Problema:** Cuando el último intento falla, no se appendea ningún turno → `turns.length === 0` → el footer muestra "Cerrar" en lugar del textarea. El usuario queda atrapado sin poder reformular dentro del drawer.

**Cambios:**
- En `aiDrawer.ts`: agregar bandera `hasStarted` que se prende en cuanto se llama `ask()` por primera vez en la conversación (independiente de éxito/error). `clearConversation()` la apaga.
- En `AiDrawer.tsx`: el footer renderiza el composer siempre que `hasStarted || turns.length > 0`. El textarea ya queda disponible para reintentar/reformular sin pasar por el TopBar.
- Cuando hay error y `turns.length === 0`, mostrar también el banner de error sobre el composer (ya existe la lógica, solo asegurar que se renderice antes del `<div ref={scrollEndRef} />` aunque no haya turnos).

## 2. `create_deal` usa la probabilidad real de la primera etapa

**Problema:** El handler en `ai-execute` selecciona la primera etapa pero asigna siempre `probability = 10` hardcodeado. La tabla `pipeline_stages` no tiene columna `probability` (verificado en el schema), pero los stages especiales sí afectan: `is_won → 100`, `is_lost → 0`.

**Cambios en `supabase/functions/ai-execute/index.ts` (case `create_deal`):**
- Al hacer fallback a la primera etapa, también leer `is_won, is_lost` y derivar la probabilidad: `is_won ? 100 : is_lost ? 0 : 10`.
- Cuando viene `stage_id` explícito, leer también `is_won, is_lost` y aplicar la misma lógica si el usuario no pasó `probability`.
- Mantener el override del usuario si pasa `probability` numérica válida.

## 3. Nueva tool `propose_link_contact_to_deal`

**Problema:** Si la IA crea un deal sin contacto (porque no encontró match) y luego el usuario dice "vincúlalo a Juan Pérez", no hay tool para ese caso. Hoy cae en limbo o termina como `update_deal_amount` mal usada.

**Backend (`global-ai/index.ts`):**
- Nueva tool `propose_link_contact_to_deal` con parámetros: `deal_id` (req), `contact_id` (req), `summary`, `reasoning`.
- Mapear en `KIND_MAP` → `link_contact_to_deal`.
- Ajuste de prompt: "Si el usuario menciona un deal existente y un contacto a vincular, usa `propose_link_contact_to_deal` (no `update_deal_amount`)."

**Backend (`ai-execute/index.ts`):**
- Agregar `link_contact_to_deal` al type union `Kind`.
- **Preview:** leer el `contact_id` actual del deal y el nuevo nombre del contacto. Devolver before/after con el campo "Contacto".
- **Execute:** validar UUIDs, hacer `update` sobre `deals` con `contact_id`. Devolver `target_type=deal`.

**Frontend (`src/services/ai.ts`):**
- Agregar `"link_contact_to_deal"` a `ProposalKind`.

**Frontend (`AiDrawer.tsx`):**
- Icon: `Link2` (lucide-react).
- En `ProposalEditForm`: caso `link_contact_to_deal` con un input readonly del `deal_id` y un select/input del `contact_id` (el usuario podrá pegarlo si quiere cambiarlo manualmente — la mayoría de casos vendrá del agente).
- `invalidateForKind`: invalidar `["deals"]` y `["pipeline"]`.

## 4. UI para múltiples candidatos de `search_entity`

**Problema:** Cuando hay 2+ "Juan" en la base, la IA pregunta en texto plano: "¿Te refieres a Juan Pérez (5512...) o Juan García (3322...)?". El usuario tiene que escribir el apellido completo en el composer. Sin chips clickeables, el flujo se siente lento.

**Backend (`global-ai/index.ts`):**
- Cuando la IA llame a `search_entity` y haya 2-5 candidatos, en vez de meterlos como texto en la respuesta, **adjuntar a la respuesta** un nuevo array `candidates: { kind, id, name, subtitle }[]` (campo paralelo a `proposals`/`actions` en el JSON que devuelve la edge function).
- Ajustar el system prompt: "Si `search_entity` devuelve >1 resultado, NO propongas nada todavía. En tu texto di brevemente '¿A cuál te refieres?' y emite los candidatos via la tool `present_candidates` (nueva)".
- Nueva tool `present_candidates` con `{ kind, intent, candidates: [{id, name, subtitle?}] }` donde `intent` describe qué hará el usuario al elegir (ej: "vincular al deal X", "crear deal para este contacto").

**Frontend (`src/services/ai.ts`):**
- Extender `AskAiResult` con `candidates?: CandidateChoice[]` y exportar el tipo.

**Frontend (`store/aiDrawer.ts`):**
- Persistir `candidates` en cada turno (`AiQuery`).

**Frontend (`AiDrawer.tsx`):**
- Renderizar bloque "Selecciona uno:" con los candidatos como botones clickeables (similar al estilo de las acciones sugeridas).
- Al hacer click, se construye un follow-up automático tipo `"Sí, ese: <name>"` o `"Usa <name>"` y se manda como nuevo turno via `ask()` con el `intent` original como pista. Esto deja que la IA continúe el flujo (vincular, crear, etc.) sin que el usuario teclee.

---

## Verificación

1. **Composer en error:** desconectar el gateway (forzar 500), preguntar algo → sale banner de error y el textarea sigue activo. Reintentar desde el composer.
2. **Probabilidad real:** crear deal nuevo cuando la primera etapa es la default ("Nuevo lead") → probabilidad = 10. Cambiar la primera etapa a una marcada `is_won` → probabilidad = 100.
3. **Link contacto:** "crea deal de 50000" (sin contacto) → confirmar → "vincúlalo a Juan Pérez" → propuesta `link_contact_to_deal` con preview del cambio de contacto.
4. **Multi-candidato:** crear dos contactos llamados "Juan" → "crea deal de 30000 para Juan" → la IA pregunta y muestra chips clickeables con cada Juan + empresa/teléfono. Click → continúa con la creación.

## Archivos a tocar

| Archivo | Cambios |
|---|---|
| `src/store/aiDrawer.ts` | Bandera `hasStarted`, persistir `candidates` por turno |
| `src/components/walix/AiDrawer.tsx` | Composer condicional, render de `candidates`, caso `link_contact_to_deal` en form, icon |
| `src/services/ai.ts` | `ProposalKind` += `link_contact_to_deal`, tipo `CandidateChoice`, extensión de `AskAiResult` |
| `supabase/functions/global-ai/index.ts` | Tools `propose_link_contact_to_deal` + `present_candidates`, ajuste prompt, mapeo `KIND_MAP`, propagar `candidates` en respuesta |
| `supabase/functions/ai-execute/index.ts` | Handler `link_contact_to_deal` (preview + execute), fix probabilidad en `create_deal` |

Sin migraciones de DB. Sin nuevas dependencias.
