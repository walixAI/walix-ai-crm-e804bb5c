## Plan: Opción A — Vendedor siempre gana, con reversión automática

### Comportamiento final

1. **Mensaje entrante por WhatsApp** (mismo `phone_number_id` con dos canales registrados: `clients` y `team`):
   - Buscar TODOS los canales con ese `phone_number_id` (no `.maybeSingle()`).
   - Buscar al remitente en `whatsapp_user_access` (variantes de teléfono) entre los tenants de los canales encontrados, sólo registros con `enabled = true`.
   - **Si existe vendedor autorizado** → enrutar al canal `team` de ese tenant → ejecutar `whatsapp-ai-command` (bot).
   - **Si NO existe vendedor autorizado** → enrutar al canal `clients` (si existe) → flujo normal de contacto.
   - Si sólo hay un canal (caso normal de un número único), se mantiene el comportamiento actual.

2. **Reversión automática al dar de baja un vendedor**:
   - El número ya queda fuera de `whatsapp_user_access` (o con `enabled = false`), así que el siguiente mensaje entrante se enruta automáticamente al canal `clients` sin necesidad de tocar nada manual.
   - No se requiere migración ni limpieza de conversaciones previas: las conversaciones del bot quedan archivadas (no se borran) y la nueva conversación se crea/abre como cliente la próxima vez que escriba.

### Archivo a modificar

- `supabase/functions/whatsapp-webhook/index.ts` — única modificación.
  - Reemplazar la consulta `.eq("phone_number_id", ...).maybeSingle()` (líneas 120-124) por un `select` que traiga todos los canales con ese `phone_number_id`.
  - Si hay múltiples, decidir cuál usar por mensaje según si `from` está en `whatsapp_user_access` con `enabled = true`.
  - Reutilizar las ramas existentes `channel.kind === "clients"` y `channel.kind === "team"` sin tocar su lógica interna.

### Sin cambios en

- Base de datos (no hay migración).
- Frontend (la tabla de vendedores y el botón de eliminar ya hacen `delete` / `enabled = false` correctamente).
- Otras edge functions.

### Después de implementar

- Redesplegar `whatsapp-webhook`.
- Verificar con logs (`supabase--edge_function_logs`) que un mensaje del vendedor llega al bot y, tras eliminarlo de la lista, el siguiente mensaje crea contacto en `clients`.
