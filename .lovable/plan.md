# Mejoras de prioridad baja — AI Drawer (Walix.ai)

Cuatro mejoras de pulido y observabilidad. **Ningún cambio de DB ni de RLS.**

---

## #2 — Auto-preview estable cuando llegan propuestas nuevas

**Problema:** El `useEffect` que dispara `previewProposal` para cada propuesta nueva depende solo de `turns.length` (`AiDrawer.tsx:171`). Si en el mismo turno llegan propuestas adicionales (caso raro tras un reintento de la IA), el efecto no se vuelve a ejecutar y esas propuestas se quedan sin preview hasta que el usuario haga refresh manual.

**Cambio:** Hacer la dependencia un hash estable del **set de IDs de propuestas vistas**, no del conteo de turnos.

```ts
// AiDrawer.tsx — reemplazar el useEffect de auto-preview
const proposalIdsKey = useMemo(
  () => turns.flatMap(t => t.proposals ?? []).map(p => p.id).sort().join("|"),
  [turns]
);
useEffect(() => {
  const all = turns.flatMap(t => t.proposals ?? []);
  all.forEach(p => {
    if (previews[p.id]) return;
    setPreviews(s => ({ ...s, [p.id]: { loading: true } }));
    previewProposal({ ...p, payload: livePayloads[p.id] ?? p.payload }).then(res => {
      setPreviews(s => ({
        ...s,
        [p.id]: res.ok ? { before: res.before, after: res.after } : { error: res.error },
      }));
    });
  });
}, [proposalIdsKey]);
```

Beneficio: idempotente, cubre cualquier nueva propuesta en cualquier turno, sin re-fetch innecesarios.

---

## #3 — Edición segura de propuestas (no sobreescribir con strings vacíos)

**Problema:** El componente `ProposalEditForm.Field` (línea 783) hace `value={payload[k] ?? ""}` y al guardar persiste **todos** los keys, incluso vacíos. Si la propuesta original traía `email: "juan@x.com"` y el usuario solo edita `phone`, el `payload` final puede llevar `email: ""` si el campo se renderizó pero no fue tocado, sobrescribiendo el valor original al ejecutar `update_contact`.

**Cambios:**

1. **Frontend (`ProposalEditForm`)**: Al construir el payload final en `applyEdit` (donde se hace `setLivePayloads`), filtrar keys cuyo valor sea string vacío para que el backend reciba solo los campos modificados realmente:

```ts
const cleanPayload = Object.fromEntries(
  Object.entries(editPayload[p.id] ?? p.payload).filter(([_, v]) => v !== "" && v != null)
);
setLivePayloads(s => ({ ...s, [p.id]: cleanPayload }));
refreshPreview(p, cleanPayload);
```

2. **Backend (`ai-execute` para `update_contact` y `update_deal_*`)**: Defensa en profundidad — antes de hacer `.update(p)`, eliminar keys vacías:

```ts
const sanitized = Object.fromEntries(
  Object.entries(p).filter(([_, v]) => v !== "" && v != null)
);
await supabase.from("contacts").update(sanitized).eq("id", p.contact_id);
```

Beneficio: cero regresiones de datos por edición parcial.

---

## #15 — Tests Deno para flujos críticos del agente

**Problema:** No hay tests para los handlers de `ai-execute`. Riesgo de romper `create_deal` o `send_whatsapp_message` sin darse cuenta.

**Cambio:** Crear `supabase/functions/ai-execute/index_test.ts` con cobertura mínima:

- `create_deal` con stage_id que tiene `is_won=true` → verifica `probability=100`.
- `create_deal` con stage_id `is_lost=true` → `probability=0`.
- `create_deal` con stage normal → `probability=10`.
- `send_whatsapp_message` con `body=""` → 400.
- `send_whatsapp_message` con `body` >1000 chars → 400.
- `send_whatsapp_message` en conversación `Cerrado` → 400.
- `update_contact` con `email=""` → no sobreescribe el email previo (cubre #3).

Los tests usan el patrón existente de Deno + `dotenv/load.ts`, llamando al edge function deployado con `fetch`. Se aprovecha la sesión actual para tener un `Authorization` válido. Si no hay sesión, los tests se saltan con `Deno.test.ignore`.

Archivo nuevo: `supabase/functions/ai-execute/index_test.ts` (~150 líneas).

---

## #16 — Audit log enriquecido con historial conversacional

**Problema:** `audit_log.metadata` guarda `prompt` (el último), `summary` y `payload`, pero no el **hilo conversacional** que llevó a esa propuesta. Imposible debuggear "¿por qué la IA propuso bajar el monto del deal X?" cuando el contexto venía de turnos previos.

**Cambios:**

1. **`src/services/ai.ts`** → al ejecutar una propuesta, incluir los últimos 3 turnos (user+assistant) como `conversation_history`:

```ts
export async function executeProposal(p: ProposedChange, ctx: { prompt?: string; history?: Array<{role:string; content:string}> }) {
  // body ya envía prompt; agregar history
}
```

2. **`AiDrawer.tsx`** → al llamar `executeProposal`, pasar el slice de turnos:

```ts
const histSlice = turns.slice(-3).flatMap(t => [
  { role: "user", content: t.prompt },
  { role: "assistant", content: t.answer.slice(0, 500) },
]);
const res = await executeProposal({ ...p, payload: finalPayload }, { prompt: current?.prompt, history: histSlice });
```

3. **`supabase/functions/ai-execute/index.ts`** → recibir y persistir en metadata:

```ts
metadata: {
  proposal_id: body.proposal_id,
  summary: body.summary ?? null,
  prompt: body.prompt ?? null,
  conversation_history: body.history ?? null, // NUEVO
  payload: body.payload,
  ai_model: "google/gemini-2.5-flash",
},
```

Sin cambios de DB: `audit_log.metadata` ya es `jsonb`. Truncamos cada `assistant` a 500 chars para mantener el JSON manejable.

---

## Orden de implementación

1. **#2** (5 min, 1 archivo) — refactor menor del useEffect.
2. **#3** (15 min, 2 archivos) — frontend + backend para sanitizar.
3. **#16** (15 min, 3 archivos) — propagar history al audit log.
4. **#15** (30 min, 1 archivo nuevo) — tests Deno + ejecutarlos para confirmar verde.

## Sin tocar

- DB schema, RLS, auth, plan/limits, Supabase config.
- Edge functions distintos a `ai-execute`.
- UI fuera del AI Drawer.

## Verificación post-implementación

- Correr los tests Deno con `test_edge_functions` y validar que pasen.
- Probar en preview: editar un contacto dejando un campo vacío y confirmar que NO se borra.
- Aprobar una propuesta y consultar `audit_log` con `read_query` para ver `conversation_history` poblado.

¿Procedo?
