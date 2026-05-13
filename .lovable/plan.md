## Objetivo

Reemplazar el formulario manual de "Conectar WhatsApp" por el **Embedded Signup oficial de Meta**. El tenant hace clic, se abre el popup de Facebook, elige/crea su WABA y número, y queda conectado. **El UI nunca pide App ID, App Secret, tokens ni URLs.**

Aplica a ambos canales: **Clientes** y **Equipo (Walix Bot)**. Modelo: **Tech Provider puro** (el cliente paga conversaciones a Meta directamente).

## Secretos a configurar (una sola vez, backend)

Se solicitarán con la herramienta segura `add_secret`:

- `META_APP_ID` — ID de la app Walix en Meta (hoy `2128562141261600`)
- `META_APP_SECRET` — App Secret (rotar el que pegaste en chat antes de dármelo)
- `META_CONFIG_ID` — Config ID del Embedded Signup (hoy `1343720567853384`)
- `META_VERIFY_TOKEN` — Verify Token global del webhook configurado en Meta

Cambiar de app más adelante = actualizar estos 4 secretos. **Cero cambios de código.**

Para el frontend, expondremos `VITE_META_APP_ID` y `VITE_META_CONFIG_ID` en `.env` (son públicos por diseño en el flujo de Facebook SDK).

## Flujo de usuario

1. En **Settings → WhatsApp**, cada canal (Clientes / Equipo) muestra un botón **"Conectar WhatsApp"**.
2. Al hacer clic:
   - Se carga el **Facebook JS SDK** (una sola vez por sesión).
   - Se abre `FB.login(...)` con el `config_id` del Embedded Signup.
   - El usuario completa el flujo de Meta dentro del popup (selección de cuenta de negocio, número, verificación).
3. Al cerrar el popup recibimos `code`, `phone_number_id` y `waba_id` (vía `message` event + callback de FB).
4. El frontend llama a la edge function `whatsapp-embedded-signup` con esos datos + `tenant_id` + `kind`.
5. El backend hace todo el trabajo (ver más abajo) y responde con el canal conectado.
6. UI muestra estado **Conectado** con número, nombre verificado y badge "via Meta Embedded Signup".

## Backend: nueva edge function `whatsapp-embedded-signup`

`verify_jwt = true` (requiere sesión del tenant). Pasos al recibir `{ code, phone_number_id, waba_id, tenant_id, kind }`:

1. Validar sesión del usuario y que pertenezca al `tenant_id`, con permiso de admin.
2. **Intercambiar `code` por access_token**:
   `GET graph.facebook.com/v20.0/oauth/access_token?client_id={APP_ID}&client_secret={APP_SECRET}&code={code}`
   → obtenemos un **business token** de larga duración (no expira mientras el WABA esté asignado a la app).
3. **Suscribir la app al WABA** (necesario para recibir webhooks):
   `POST graph.facebook.com/v20.0/{waba_id}/subscribed_apps` con `Bearer {access_token}`.
4. **Registrar el número** para Cloud API:
   `POST graph.facebook.com/v20.0/{phone_number_id}/register` con `messaging_product=whatsapp` y `pin` generado.
5. Obtener metadatos del número (`display_phone_number`, `verified_name`):
   `GET graph.facebook.com/v20.0/{phone_number_id}`.
6. **Upsert en `whatsapp_channels`** (por `tenant_id` + `kind`):
   - `provider='meta_embedded_signup'`
   - `phone_number`, `phone_number_id`, `business_account_id=waba_id`
   - `display_name=verified_name`, `access_token` (encriptado en columna existente)
   - `verify_token = META_VERIFY_TOKEN` (global)
   - `status='connected'`, `connected_at=now()`
7. Devolver `{ ok: true, channel }` al frontend.

Hooks dejados listos (sin ejecutar) para futuro Solution Partner: comentario en el código indicando dónde llamar `extend_credit_line` si más adelante se cambia de modelo.

## Webhook (`whatsapp-webhook`)

Cambio mínimo: en el handshake `GET`, comparar el `hub.verify_token` contra `META_VERIFY_TOKEN` (global) **además** del lookup actual por `verify_token` por canal — así soportamos canales nuevos (Embedded Signup, token global) y los antiguos (token por canal) sin romper nada.

El resto del webhook (matching por `phone_number_id`, mensajería, IA) ya funciona y no se toca.

## Frontend

- **Nuevo helper** `src/lib/whatsapp/metaEmbedded.ts`: carga `https://connect.facebook.net/en_US/sdk.js` una sola vez, expone `launchEmbeddedSignup()` que:
  - Llama `FB.init({ appId: VITE_META_APP_ID, version: 'v20.0' })`.
  - Suscribe `window.addEventListener('message', ...)` para capturar `phone_number_id` y `waba_id` del evento `WA_EMBEDDED_SIGNUP`.
  - Llama `FB.login(cb, { config_id: VITE_META_CONFIG_ID, response_type: 'code', override_default_response_type: true })`.
  - Resuelve una promesa con `{ code, phone_number_id, waba_id }` o rechaza si el usuario cancela.

- **Nuevo componente** `EmbeddedSignupButton.tsx` (reemplaza `ConnectChannelDialog` para el flujo de conexión inicial):
  - Botón único "Conectar WhatsApp" con loader.
  - Llama el helper, luego `supabase.functions.invoke('whatsapp-embedded-signup', { body: { code, phone_number_id, waba_id, kind } })`.
  - Toast de éxito/error.

- **Nuevo query mutation** `useEmbeddedSignup(tenantId)` en `src/lib/queries/whatsappChannels.ts`.

- En `src/components/settings/whatsapp/`:
  - Reemplazar el botón "Conectar" actual por `<EmbeddedSignupButton kind="clients" />` y `<EmbeddedSignupButton kind="team" />`.
  - Conservar `ConnectChannelDialog` y `useUpsertChannel` solo como fallback oculto detrás de un menú "Conexión avanzada (manual)" para casos extremos. Si prefieres, lo eliminamos por completo — confírmame.

## Base de datos

La tabla `whatsapp_channels` ya tiene todas las columnas necesarias (`phone_number_id`, `business_account_id`, `access_token`, `verify_token`, `status`, `connected_at`). **Sin migración requerida.**

Solo añadiremos en código el valor `'meta_embedded_signup'` al campo `provider` (string libre, no enum).

## Configuración

`supabase/config.toml` — añadir:
```toml
[functions.whatsapp-embedded-signup]
  verify_jwt = true
```

## Detalles técnicos

- Facebook SDK se carga lazy solo cuando se abre la página de WhatsApp.
- El `business token` devuelto por Meta no expira mientras Walix siga siendo Tech Provider del WABA — no necesitamos refresh.
- Si el tenant desconecta el WABA desde Business Manager, el siguiente webhook fallará y marcaremos `status='error'` con mensaje claro.
- CORS, Zod validation, y manejo de errores con mensajes únicos en la edge function siguen el patrón estándar.

## Pasos de implementación (orden)

1. Pedirte rotar el App Secret en Meta y configurar los 4 secretos vía `add_secret`.
2. Crear edge function `whatsapp-embedded-signup` y entrada en `config.toml`.
3. Ajustar `whatsapp-webhook` para aceptar verify token global.
4. Crear helper Meta + componente `EmbeddedSignupButton` + mutation.
5. Integrar botón en la pantalla de Settings → WhatsApp para ambos canales.
6. Probar end-to-end con tu número de prueba.
