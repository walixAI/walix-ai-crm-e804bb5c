
## Diagnóstico

El canal `clients` está marcado como `connected` pero:
- `last_inbound_at` y `last_inbound_from` siguen en `null`.
- La edge function `whatsapp-webhook` no tiene **ningún** log de invocación.

Conclusión: Meta no está llamando al webhook. La causa más probable, dado que la URL ya está verificada, es que **la WhatsApp Business Account (WABA) no está suscrita al campo `messages`** en tu app de Meta.

## Qué hacer en Meta (sin código)

Pasos exactos para suscribir el webhook a `messages`:

1. Abre **developers.facebook.com → tu App** (la que tiene `App ID = META_APP_ID`).
2. Menú lateral → **WhatsApp → Configuration** (Configuración).
3. Baja a la sección **Webhook**. Verás Callback URL ya verificada.
4. En **Webhook fields**, busca la fila `messages` y haz clic en **Subscribe** (o **Manage** y activa `messages`). Confirma que el switch quede en verde.
5. (Importante para el número de prueba) Ve a **WhatsApp → API Setup**. Selecciona el número `+1 555 653 9892`. En la sección "Webhook" del propio número, asegúrate que aparezca **Subscribed** a tu app. Si no, dale **Subscribe**.
6. Vuelve a enviar un WhatsApp desde tu `+52 1 5517278186` (ya está en la lista de "To") al número de prueba.

Si el paso 4 ya estaba hecho pero el 5 no, ese es el problema más común con números de prueba.

## Cambios de código que añadiré para diagnóstico

Para que no tengas que adivinar la próxima vez:

1. **`whatsapp-webhook/index.ts`** — añadir logs estructurados al inicio y al final:
   - Log de cada GET (verify handshake) con `mode`, `token` (enmascarado) y resultado.
   - Log de cada POST con `entry.id`, `phone_number_id`, número de `messages` y `statuses`.
   - Log explícito cuando no encuentra `channel` por `phone_number_id` (frecuente si el `phone_number_id` guardado no coincide con el que envía Meta).
   - Guardar el último payload crudo en una columna nueva para inspección desde la UI.

2. **Migración DB** — añadir a `whatsapp_channels`:
   - `last_webhook_payload jsonb` (último cuerpo recibido, útil aunque no matchee).
   - `last_webhook_at timestamptz`.
   Y una tabla `whatsapp_webhook_log` (últimos 50 hits por tenant, TTL manual) con: `received_at`, `phone_number_id`, `matched_channel_id`, `payload`, `note`.

3. **UI: `src/components/settings/whatsapp/WhatsappTab.tsx`** — nuevo panel "Diagnóstico del webhook" (collapsible) que muestre:
   - Última verificación GET recibida (timestamp).
   - Últimos 5 hits POST con timestamp, `phone_number_id`, si matcheó canal, y un botón "ver payload".
   - Si en los últimos 5 minutos no hay ningún hit tras pulsar "Iniciar prueba", mostrar un banner amarillo con el checklist de Meta (los 6 pasos de arriba).

4. **`LiveTestDialog.tsx`** — además de poll a `last_inbound_at`, polear `last_webhook_at`. Distinguir tres estados:
   - "Sin hits del webhook" → problema de configuración en Meta.
   - "Hit recibido pero `phone_number_id` no coincide" → el canal guardado tiene otro `phone_number_id`; mostrar cuál llegó vs cuál esperamos.
   - "Hit recibido y matcheado pero `from` distinto" → ya lo tienes.

## Detalles técnicos

```text
Tabla nueva:
whatsapp_webhook_log(
  id uuid pk, tenant_id uuid null, received_at timestamptz default now(),
  phone_number_id text, matched_channel_id uuid null,
  kind text check (kind in ('verify','message','status','unknown')),
  payload jsonb, note text
)
RLS: SELECT solo a tenant_admin/owner del tenant; INSERT solo service role.
Para verify (sin tenant): visible a platform staff únicamente.
```

El webhook escribirá un row por cada POST recibido (truncando `payload` a ~10KB) y por cada GET handshake.

## Verificación

Tras desplegar:
1. Tú haces los pasos 1-6 de Meta y envías un WhatsApp.
2. Yo consulto `whatsapp_webhook_log` para confirmar el hit y te digo exactamente qué llegó.
3. Si llega y matchea, el `LiveTestDialog` pasará a "success" automáticamente.

## Fuera de alcance

- No tocaré el flujo de `whatsapp-embedded-signup` ni el envío saliente.
- No cambiaré `phone_number_id` ni `access_token` del canal (eso se hace por re-conectar).
