# Fase 1 — Walix.ai como Agente Ejecutor

Convierte el chat de "Pregúntale a tu IA" de un asistente de solo lectura en un **agente que ejecuta acciones reales** en el CRM, siempre con un paso intermedio de **vista previa + confirmación humana** y registro completo en `audit_log`.

## Alcance de Fase 1

### Acciones que el agente podrá proponer y ejecutar

1. **`update_deal_stage`** — mover un deal a otra etapa del pipeline
2. **`update_deal_amount`** — cambiar monto y/o probabilidad de un deal
3. **`mark_deal_won`** / **`mark_deal_lost`** — cerrar deal (lost requiere razón)
4. **`create_task`** — crear tarea (título, due_at, asignado opcional, vinculada a deal/contact)
5. **`create_activity`** — registrar nota/llamada/email manual
6. **`update_contact`** — editar campos básicos (nombre, email, empresa, posición, status, tags)
7. **`create_contact`** — alta rápida de contacto

Las acciones existentes de solo navegación (`open_deal`, `open_contact`, etc.) se mantienen como antes.

### Flujo end-to-end

```text
Usuario escribe en AiDrawer
        │
        ▼
global-ai (edge function) ── modelo decide tool calls ──┐
        │                                                │
        │ devuelve: text + actions (open_*) + proposals  │
        ▼                                                │
AiDrawer renderiza respuesta + tarjetas "Vista previa"  │
        │                                                │
        │ usuario revisa cambios línea por línea         │
        ▼                                                │
[Confirmar]   [Editar]   [Descartar]                     │
        │                                                │
        ▼                                                │
ai-execute (edge function) ─ valida RLS, ejecuta ────────┘
        │
        ▼
Inserta en audit_log + refetch React Query + toast
```

Nada se ejecuta sin un click humano explícito en **Confirmar**.

## Cambios técnicos

### 1. Edge function `global-ai` (modificar)

Añadir herramientas nuevas al array `tools` (function calling de Gemini):

- `propose_deal_update` — params: `deal_id`, `stage_name?`, `amount?`, `probability?`, `reason`
- `propose_close_deal` — params: `deal_id`, `outcome: 'won'|'lost'`, `lost_reason?`, `lost_comment?`
- `propose_create_task` — params: `title`, `due_at?`, `deal_id?`, `contact_id?`, `assignee_id?`
- `propose_create_activity` — params: `type`, `description`, `deal_id?`, `contact_id?`
- `propose_update_contact` — params: `contact_id`, campos opcionales
- `propose_create_contact` — params: `name`, `phone`, opcionales

El prompt de sistema instruye:
> "Cuando el usuario pida ejecutar una acción, NO afirmes que ya la hiciste. Llama a la herramienta `propose_*` correspondiente con los datos exactos. La acción solo se ejecuta cuando el usuario confirme en la UI."

La respuesta JSON ahora incluye:
```ts
{ text, actions: AiAction[], proposals: ProposedChange[] }
```

donde cada `ProposedChange` lleva `id` (uuid), `kind`, `summary` legible (ej: "Mover **Cliente Acme** de Negociación → Cerrado ganado"), `payload` validado con catálogo de IDs, y `entity_label`.

### 2. Edge function nueva `ai-execute`

- Recibe `{ proposal_id, kind, payload }` ya firmado por la sesión.
- Valida con Zod cada `kind`.
- Ejecuta vía supabase-js scoped al JWT del usuario (RLS aplica → seguridad multi-tenant gratis).
- Inserta fila en `audit_log` con `action='ai_execute_<kind>'`, `target_type`, `target_id`, `metadata={ prompt, summary, payload, ai_model }`, `actor_id`.
- Devuelve `{ ok, target_id, error? }`.

### 3. Frontend — `AiDrawer.tsx`

- Nueva sección **"Cambios propuestos"** debajo de la respuesta y antes de "Acciones sugeridas".
- Cada proposal renderiza un card con:
  - Ícono según tipo (KanbanSquare, CheckCircle, ListTodo, UserPlus…)
  - Resumen markdown (`Mover **Acme** → Cerrado ganado`)
  - Diff compacto (campos cambiados)
  - Botones: **Confirmar** (primary), **Descartar** (ghost)
- Al confirmar: llama `executeProposal()`, muestra spinner, al éxito reemplaza el card por un check verde "Ejecutado · ver en auditoría", invalida queries de React Query relevantes (deals, tasks, contacts).
- Estado local: `Map<proposalId, 'idle'|'running'|'done'|'error'>`.

### 4. `src/services/ai.ts`

- Tipo `ProposedChange` exportado.
- `askAi()` ahora retorna `{ text, actions, proposals, source }`.
- Nueva función `executeProposal(p: ProposedChange)` → invoca `ai-execute`.

### 5. `src/store/aiDrawer.ts`

- `AiQuery` añade `proposals: ProposedChange[]`.
- Persistencia local sigue igual (Fase 2 migra a DB).

### 6. UI de auditoría existente

`audit_log` ya está creado con RLS y la página existe (`src/services/audit.ts`, `src/lib/queries/auditLog.ts`). El nuevo flujo simplemente inserta con `action LIKE 'ai_execute_%'`. No requiere cambios de schema.

## Seguridad

- **Sin SQL crudo**, sin `service_role` en `ai-execute` — usamos el JWT del usuario, RLS hace cumplir tenant + permisos.
- **Catálogo cerrado de IDs**: el modelo solo puede referenciar UUIDs presentes en el contexto (deals/contacts/convos top-N). Validamos en backend que el ID exista y pertenezca al tenant antes de ejecutar.
- **Validación Zod estricta** por cada `kind` en `ai-execute`.
- **Sin auto-ejecución**: el endpoint `ai-execute` requiere click humano; `global-ai` nunca toca la DB de escritura.
- **Auditoría inmutable**: `audit_log` no permite UPDATE/DELETE por RLS.

## Fuera de alcance (Fases siguientes)

- Persistencia server-side de threads (Fase 2)
- Bridge a WhatsApp Operator (Fase 3)
- Tools de masa (bulk update N deals) — primero validamos UX 1-a-1
- Deshacer una acción ejecutada (revert)

## Entregables

1. `supabase/functions/global-ai/index.ts` — añade tools `propose_*` y devuelve `proposals`
2. `supabase/functions/ai-execute/index.ts` — nueva función con validación Zod + audit
3. `src/services/ai.ts` — tipos + `executeProposal()`
4. `src/store/aiDrawer.ts` — soporta `proposals` en `AiQuery`
5. `src/components/walix/AiDrawer.tsx` — UI de vista previa, confirmación y estado de ejecución
6. Sin migración SQL — `audit_log` ya existe