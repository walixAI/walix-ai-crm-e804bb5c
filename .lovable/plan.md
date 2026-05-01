
# Sprint 2A — Hotfix: completar funcionalidad de propuestas IA

Tras validar la implementación se detectaron 7 bugs/incompletos que impiden que el flujo "preview → editar → confirmar" funcione 100%. Los arreglos son acotados, sin cambios de arquitectura.

---

## 1. Selector de etapa en `ProposalEditForm` (alta prioridad)

**Problema:** Al editar una propuesta `update_deal_stage`, el form muestra un input de texto pidiendo un UUID — imposible de usar.

**Fix:** 
- En `AiDrawer.tsx`, cargar `pipeline_stages` (vía hook existente o query nuevo) y pasarlo como prop `stages` al `ProposalEditForm`.
- Reemplazar el `<Field>` por un `<Select>` de shadcn que lista las etapas con su nombre.

## 2. Selectores con enum para `status` y `type`

**Problema:** Los campos `status` (lead) y `type` (activity) son inputs libres; si el usuario escribe un valor fuera del enum, el backend devuelve 400 sin diff visible.

**Fix:** En `ProposalEditForm`, sustituir esos `<Field>` por `<Select>` con las opciones válidas:
- `status`: `Nuevo | Contactado | Calificado | Propuesta | Cerrado | Perdido`
- `type`: `note | deal | task | wa_sent | wa_received`

## 3. Preservar ediciones acumuladas

**Problema:** Al "Aplicar cambios" se hace `{ ...p.payload, ...draft }`, perdiendo cualquier edición previa guardada en `livePayloads`.

**Fix:** Cambiar a `{ ...(livePayloads[p.id] ?? p.payload), ...draft }` (línea ~356).

## 4. Auto-refresh de preview cuando cambia el payload editado

**Problema:** El `useEffect` que dispara `previewProposal` solo depende de `current?.id`. Cuando `livePayloads` cambia, no re-fetcha automáticamente (depende de la llamada manual de `refreshPreview` que ya existe — ok, pero falta el caso de cancel/re-abrir editor).

**Fix:** Asegurar que al cancelar el editor, si `livePayloads[p.id]` existía, se invoque `refreshPreview` para mantener consistencia. Caso menor; con la línea actual basta si `refreshPreview` se llama siempre que haya cambios — verificarlo.

## 5. Validar `lost_reason` en modo preview

**Problema:** `mark_deal_lost` en preview no valida que `lost_reason` esté presente. El usuario ve diff "Estado → Perdido" y al confirmar recibe error 400 "lost_reason requerido".

**Fix en `ai-execute/index.ts`:** En el `case "mark_deal_lost"` del bloque `preview`, si `!p.lost_reason`, devolver `bad(400, "Falta motivo de pérdida — edita la propuesta")` para que el card muestre el error temprano.

## 6. UI de error duplicada

**Problema:** Cuando `source === "error"`, el drawer muestra simultáneamente: (a) la burbuja del prompt con el texto de fallback "No pude conectar…", y (b) el banner rojo grande con "No pude conectar con el servicio de IA". Es ruido visual.

**Fix en `AiDrawer.tsx`:** Cuando `source === "error"`, ocultar la sección normal de answer/proposals/feedback y mostrar SOLO el banner de error con el prompt original arriba. Reorganizar el JSX: el bloque `{current && !loading && source === "error"}` debe **reemplazar** al bloque `{current && !loading}`, no añadirse.

## 7. Backoff más agresivo para 429

**Problema:** `askAi` reintenta una sola vez con 800ms; en rate limits reales suele ser insuficiente.

**Fix en `services/ai.ts`:**
- Aumentar a 2 retries con backoff exponencial: 1500ms, 3000ms.
- Solo aplicar retries cuando el error contiene "429" o "rate" o el `data.error` empieza con "Demasiadas".
- Para otros errores (4xx no-429, 5xx), 1 solo retry como ahora.

---

## Archivos a tocar

| Archivo | Cambios |
|---|---|
| `src/components/walix/AiDrawer.tsx` | Fix #2, #3, #4, #6 + cargar stages para #1 |
| `supabase/functions/ai-execute/index.ts` | Fix #5 (validación preview) — redeploy automático |
| `src/services/ai.ts` | Fix #7 (retry policy) |

## Cómo se verifica

1. Ir a un deal abierto → preguntar "muévelo a Negociación" → editar la propuesta → verificar que aparezca un dropdown de etapas, no un campo UUID.
2. Pedir "marca el deal de Acme como perdido" sin dar motivo → debe aparecer el error en el preview, no después de confirmar.
3. Provocar un error de red (offline) → debe verse solo el banner rojo, sin la burbuja gris duplicando el mensaje.
4. Editar una propuesta dos veces seguidas → la segunda edición debe conservar lo aplicado en la primera.

Sin migraciones de DB. Sin nuevas dependencias. Estimado: ~150 líneas modificadas.
