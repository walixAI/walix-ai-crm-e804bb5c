# Permitir reconfigurar WhatsApp y validar conexión real

## Problema
1. Tras configurar el canal, no hay forma de editar credenciales (token, phone_number_id, etc.).
2. El badge "Conectado" se muestra solo porque se guardó la fila — nunca se valida contra Meta.

## Cambios

### 1. `ConnectChannelDialog.tsx` — modo edición
- Si `existing` channel existe, abrir el diálogo en **paso 2 (credenciales)** en vez de paso 3.
- Pre-llenar `phone_number`, `phone_number_id`, `business_account_id`, `display_name` con los valores actuales.
- `access_token` se muestra como `••••••••` placeholder; solo se envía al backend si el usuario escribe un valor nuevo (en `useUpsertChannel` se omite el campo si viene vacío).
- Añadir botón **"Atrás"** en paso 3 para regresar a paso 2.
- En paso 2 añadir botón **"Ver webhook"** para saltar a paso 3 sin tocar credenciales.

### 2. `WhatsappTab.tsx` — botón "Reconfigurar"
- En la tarjeta del canal ya configurado, añadir botón **"Reconfigurar"** (icono lápiz) que abre `ConnectChannelDialog` con el canal existente.
- Diferenciar visualmente:
  - **Configurado** (badge azul): credenciales guardadas, sin verificar.
  - **Conectado** (badge verde): verificado contra Meta API + `connected_at` no nulo.
  - Si `status='connected'` pero `connected_at` es null → texto "Configurado, esperando primer evento de Meta".

### 3. Nueva edge function `whatsapp-verify`
- `supabase/functions/whatsapp-verify/index.ts` con `verify_jwt = true`.
- Recibe `{ channel_id }`, valida que el usuario es admin del tenant del canal (vía RLS).
- Llama `GET https://graph.facebook.com/v21.0/{phone_number_id}?fields=verified_name,display_phone_number` con el `access_token` del canal.
- Si responde 200 → update `status='connected'`, `connected_at=now()`, `last_error=null`.
- Si responde error → update `status='error'`, `last_error=<mensaje Meta>`.
- Devuelve `{ ok, status, last_error?, meta_info? }`.

### 4. `whatsappChannels.ts` — `useTestChannel`
- Reemplazar el update directo por `supabase.functions.invoke('whatsapp-verify', { body: { channel_id }})`.
- Mostrar el `last_error` en toast si falla.

### 5. `useUpsertChannel` — no sobreescribir token vacío
- Si `input.access_token` está vacío o es el placeholder, omitirlo del update (mantener el actual).

### 6. `supabase/config.toml`
- Añadir bloque para `whatsapp-verify` (deja `verify_jwt = true` por defecto, no requiere entrada).

## Archivos
- editar `src/components/settings/whatsapp/ConnectChannelDialog.tsx`
- editar `src/components/settings/whatsapp/WhatsappTab.tsx`
- editar `src/lib/queries/whatsappChannels.ts`
- crear `supabase/functions/whatsapp-verify/index.ts`

## Verificación
- Click "Reconfigurar" abre diálogo con datos pre-llenados; cambiar `display_name` sin tocar token guarda correctamente.
- Click "Probar conexión" con token inválido → badge "Error" + mensaje real de Meta.
- Click "Probar conexión" con credenciales válidas → badge "Conectado" + `connected_at` poblado.
