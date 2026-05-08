## Problema

El edge function `ai-copilot` falla con HTTP 400 del gateway de IA:
`"Tool message must have either name or tool_call_id"`

Causa: al rehidratar el historial desde `ai_conversation_history`, los mensajes con `role: "tool"` se reenvían sin `tool_call_id` en el nivel raíz (se guardó dentro del campo `tool_calls` como `{ tool_call_id, name }`, pero la reconstrucción solo lo aplica a mensajes `assistant`).

## Cambios

### `supabase/functions/ai-copilot/index.ts`

1. **Reconstrucción correcta del historial** (líneas ~482–486): para mensajes `role: "tool"`, mapear `h.tool_calls.tool_call_id` y `h.tool_calls.name` a las propiedades raíz `tool_call_id` y `name` del mensaje.

2. **Saneo defensivo del historial** antes de enviar al gateway:
   - Descartar mensajes `tool` sin `tool_call_id` válido.
   - Descartar mensajes `assistant` con `tool_calls` cuyas respuestas `tool` correspondientes falten (pares huérfanos).
   - Garantizar que la secuencia enviada al modelo sea consistente.

3. **Fallback ante error 400 del gateway**: si la primera llamada devuelve 400, reintentar una sola vez con solo `system` + mensaje actual del usuario (descartando el historial corrupto), y registrar warning. Esto evita que el copilot quede inutilizable si la BD tiene filas previas malformadas.

4. **Logging mejorado**: incluir el cuerpo de error truncado en la respuesta interna (no al cliente) para futuros diagnósticos.

## Verificación

- Redesplegar `ai-copilot`.
- Probar en la app: hacer una pregunta al copilot que dispare tools (ej. "¿cómo va mi pipeline?"), seguida de una segunda pregunta en la misma sesión.
- Revisar `supabase--edge_function_logs` para confirmar ausencia del error `Tool message must have either name or tool_call_id`.
