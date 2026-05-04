# Plan: Conexión WhatsApp Business (Meta Cloud API) + Asistente Walix por WhatsApp

## Objetivo
Conectar dos números de WhatsApp Business reales vía Meta Cloud API:
- **Canal "clientes"**: conversaciones con leads (entra al inbox actual de WhatsApp).
- **Canal "equipo" (Walix Bot)**: vendedores autorizados envían comandos en lenguaje natural a la IA y operan su pipeline desde WhatsApp.

Solo `tenant_owner` / `tenant_admin` pueden conectar/desconectar canales y autorizar usuarios. Los `sales_rep` solo ven y operan sus propios datos.

---

## 1. Base de datos (migración)

### Tabla `whatsapp_channels`
Un registro por canal conectado del tenant.
- `id`, `tenant_id`, `created_at`, `updated_at`
- `kind` enum: `'clients' | 'team'` (único por tenant)
- `provider` text: `'meta_cloud'` (futuro: `'twilio'`)
- `display_name`, `phone_number`, `phone_number_id` (Meta), `business_account_id` (WABA)
- `access_token_secret_name` text — referencia al secret con el token (no guardamos token en DB)
- `verify_token` text — generado al conectar
- `status` enum: `'pending' | 'connected' | 'error' | 'disabled'`
- `last_error`, `connected_at`
- RLS: SELECT tenant; INSERT/UPDATE/DELETE solo `tenant_admin`/`tenant_owner`.

### Tabla `whatsapp_user_access`
Quién del equipo puede usar el canal "team".
- `id`, `tenant_id`, `user_id`, `phone_e164` (teléfono personal del vendedor)
- `enabled` bool, `permission_level` enum: `'read' | 'write_light' | 'write_strong'`
- `created_at`, `updated_at`
- Único `(tenant_id, phone_e164)` y `(tenant_id, user_id)`
- RLS: SELECT tenant; INSERT/UPDATE/DELETE solo admin/owner; cada usuario puede leer su propio registro.

### Tabla `whatsapp_command_log` (auditoría IA)
- `id`, `tenant_id`, `user_id`, `channel_id`, `from_phone`
- `prompt` text, `intent` text, `action_payload` jsonb
- `status` enum: `'pending_confirmation' | 'executed' | 'rejected' | 'failed'`
- `confirmation_token` text (para flujo "responde SÍ")
- `created_at`, `executed_at`
- RLS: SELECT tenant; INSERT desde edge function (service role).

### Extensión a `messages`
Agregar columna `channel_id uuid` (nullable) para distinguir clientes vs equipo.

---

## 2. Edge Functions

### `whatsapp-webhook` (público, `verify_jwt = false`)
- `GET`: handshake Meta → devuelve `hub.challenge` si `hub.verify_token` coincide con algún `whatsapp_channels.verify_token`.
- `POST`: recibe eventos de Meta. Identifica el canal por `entry[].changes[].value.metadata.phone_number_id`.
  - **Si canal `clients`**: upsert `contact` por teléfono, upsert `conversation`, insert `message` (direction=`inbound`). Realtime entrega al inbox.
  - **Si canal `team`**: busca `whatsapp_user_access` por `from`. Si no autorizado → responde "No autorizado". Si autorizado → invoca `whatsapp-ai-command`.

### `whatsapp-ai-command` (interno)
- Recibe `{ tenant_id, user_id, permission_level, prompt, from_phone }`.
- Llama a Lovable AI (Gemini) con tools: `list_deals`, `list_contacts`, `list_tasks`, `daily_summary`, `create_note`, `create_task`, `move_deal`, `mark_won`, `mark_lost`, `update_amount`, `reassign_owner`.
- Filtra tools por `permission_level`:
  - `read`: solo list/summary
  - `write_light`: + create_note, create_task, log_activity
  - `write_strong`: + move_deal, mark_won/lost, update_amount, reassign
- Aplica scoping por rol: `sales_rep` → solo registros con `owner_id = user_id`.
- Acciones `write_strong` → guarda en `whatsapp_command_log` con `status='pending_confirmation'`, responde "¿Confirmas? Responde SÍ {token}".
- Reusa la lógica de `ai-execute` para ejecutar acciones.

### `whatsapp-send` (autenticado)
- Reemplaza el insert directo del composer.
- Valida tenant, llama `POST graph.facebook.com/v20.0/{phone_number_id}/messages` con el token del canal.
- Inserta `message` con direction=`outbound` y `metadata.wamid`.
- Maneja ventana 24h y plantillas aprobadas.

`supabase/config.toml` agrega:
```toml
[functions.whatsapp-webhook]
verify_jwt = false
```

---

## 3. UI

### `WhatsappTab.tsx` (Configuración → WhatsApp) — solo admin/owner
Reemplaza la card demo por un wizard con dos secciones (Canal Clientes / Canal Equipo):

Para cada canal:
1. **Estado**: Desconectado / Pendiente / Conectado (badge + número).
2. **Botón "Conectar"** → abre dialog wizard:
   - Paso 1: Instrucciones para crear app en business.facebook.com, agregar número, copiar `Phone Number ID`, `WABA ID` y generar `System User Token`.
   - Paso 2: Inputs para pegar credenciales. Al guardar:
     - Crea registro `whatsapp_channels` con `status='pending'`.
     - Genera `verify_token` aleatorio.
     - Guarda token vía `add_secret` (nombre `WA_TOKEN_{channel_id}`).
     - Muestra **Webhook URL** (`https://qomyfafowhuxuwbuubqk.supabase.co/functions/v1/whatsapp-webhook`) y **Verify Token** para pegar en Meta.
   - Paso 3: Botón "Probar conexión" → llama función de test → marca `status='connected'`.
3. **Botón "Desconectar"** y "Reconectar".

Para canal "Equipo" — sección adicional **"Vendedores autorizados"**:
- Tabla con miembros activos del tenant.
- Por cada uno: input teléfono E.164, toggle `enabled`, select de permisos (`read` / `write_light` / `write_strong`).
- Si rol del usuario es `sales_rep`, banner: "Verá y operará solo sus propios contactos y oportunidades".

Si usuario no es admin/owner → muestra mensaje "Solo administradores pueden gestionar la conexión de WhatsApp".

### `Composer.tsx` (chat WhatsApp)
- Cambia insert directo a `supabase.functions.invoke("whatsapp-send", ...)`.
- Banner si no hay canal `clients` conectado: "Conecta WhatsApp en Configuración para enviar mensajes reales".

### Realtime
Migración: `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;`

---

## 4. Flujo del vendedor por WhatsApp (canal "team")

Ejemplo:
```
Vendedor → "qué tengo hoy"
Walix Bot → "📋 3 tareas vencen hoy:
            1. Llamar a Acme (10am)
            2. Enviar cotización Beta
            3. Seguimiento Gamma
            💼 5 oportunidades activas ($240k MXN)"

Vendedor → "marca ganada la de Acme por 50000"
Walix Bot → "⚠️ Vas a marcar 'Acme - Plan Pro' como GANADA por $50,000.
            Responde SÍ A7K9 para confirmar."

Vendedor → "SÍ A7K9"
Walix Bot → "✅ Hecho. Etapa: Ganada · Monto: $50,000."
```

---

## 5. Secretos requeridos
Al final del wizard de conexión, se solicita por canal mediante `add_secret`:
- `WA_TOKEN_CLIENTS_{tenant_id}` — System User Token del canal clientes
- `WA_TOKEN_TEAM_{tenant_id}` — System User Token del canal equipo

(El App Secret de Meta para validar firmas se solicitará una sola vez como `META_WA_APP_SECRET`.)

---

## 6. Detalles técnicos

- **Validación de firma webhook**: HMAC SHA256 con `META_WA_APP_SECRET` sobre el body crudo, header `X-Hub-Signature-256`.
- **Routing multi-tenant**: el webhook es único; se enruta por `phone_number_id` → busca `whatsapp_channels`.
- **Identificación del usuario en canal team**: por `from` (E.164) → `whatsapp_user_access.user_id`.
- **Ventana 24h**: si última inbound > 24h, `whatsapp-send` exige `template_name`.
- **Auditoría**: cada acción de IA queda en `whatsapp_command_log` + `audit_log`.
- **Rate limit**: 30 comandos/min por usuario (en `whatsapp-ai-command`).

---

## Archivos a crear/editar

**Crear:**
- `supabase/migrations/<timestamp>_whatsapp_channels.sql`
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-ai-command/index.ts`
- `supabase/functions/whatsapp-send/index.ts`
- `src/components/settings/whatsapp/ConnectChannelDialog.tsx`
- `src/components/settings/whatsapp/TeamAccessTable.tsx`
- `src/lib/queries/whatsappChannels.ts`

**Editar:**
- `src/components/settings/whatsapp/WhatsappTab.tsx` — wizard + acceso por rol
- `src/components/whatsapp/Composer.tsx` — usar `whatsapp-send`
- `supabase/config.toml` — `verify_jwt=false` para webhook

---

## Lo que necesito de ti más adelante (después de aprobar)
1. Crear app en business.facebook.com y los 2 números (no automatizable).
2. Pegar `Phone Number ID`, `WABA ID` y System User Token de cada número en el wizard.
3. Pegar el Webhook URL y Verify Token que la app te mostrará en la configuración de webhooks de Meta.

¿Apruebas para que lo implemente?