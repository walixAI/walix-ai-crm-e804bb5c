# Validación en vivo de conexión WhatsApp

Hoy la verificación solo confirma que las credenciales son válidas contra Meta (`/phone_number_id`), pero no prueba que el **webhook** esté realmente entregando mensajes a Walix. La forma definitiva de validar la conexión es que tú envíes un mensaje desde tu número personal (+52 55 3563 7687) al número de WhatsApp Business configurado y que la app lo "vea" llegar en tiempo real.

## Qué se construye

### 1. Registrar el último inbound en el canal
Migración para agregar a `whatsapp_channels`:
- `last_inbound_at timestamptz`
- `last_inbound_from text`

El webhook (`whatsapp-webhook`) actualizará estos campos en **cada** mensaje entrante (sirve tanto para canal *clients* como *team*). Si llega el primer inbound y `connected_at` está vacío, lo setea a `now()` y `status='connected'`.

### 2. Botón "Probar conexión en vivo"
En la card de cada canal de `WhatsappTab.tsx` y dentro de `ConnectChannelDialog.tsx` (paso final):

- Botón **"Probar conexión en vivo"**.
- Abre un modal con:
  - Número configurado (display).
  - Campo prellenado con el teléfono del admin (`+525535637687`), editable y normalizado a E.164.
  - Instrucción clara: *"Envía cualquier mensaje de WhatsApp desde ese número al número configurado en los próximos 2 minutos."*
  - Spinner + cuenta regresiva (120 s).
- Lógica: guarda `testStartedAt = now()` y hace **polling cada 3 s** a `whatsapp_channels` (select `last_inbound_at, last_inbound_from, status, last_error`).
  - **Éxito**: `last_inbound_at > testStartedAt` y `last_inbound_from` normalizado coincide con el teléfono ingresado → marca `status='connected'`, `connected_at=now()` (vía edge function existente o update directo) y muestra ✅ *"Conectado · primer mensaje recibido de +52 55 3563 7687"*.
  - **Llegó otro número**: muestra advertencia *"Recibimos un mensaje pero de {numero}, no del esperado"*, sigue esperando.
  - **Timeout 2 min**: muestra checklist de diagnóstico (Webhook URL, Verify Token, suscripción al campo `messages` en Meta, número en sandbox vs producción) y deja `status='pending'`.

### 3. Mostrar el último inbound en la card
En `WhatsappTab.tsx`, cuando exista `last_inbound_at`:
> *"Último mensaje recibido: hace 12 s desde +52 55 3563 7687"*

Esto da visibilidad continua de que el webhook sigue funcionando, no solo en el momento de la prueba.

## Archivos afectados

- **Migración** SQL: agregar 2 columnas a `whatsapp_channels`.
- `supabase/functions/whatsapp-webhook/index.ts`: update `last_inbound_at`, `last_inbound_from`, `connected_at`, `status` en cada inbound (ambos `kind`).
- `src/lib/queries/whatsappChannels.ts`: extender `WhatsappChannel` con los nuevos campos; nuevo hook `useLiveConnectionTest(channelId, expectedPhone)` que abre canal de polling.
- `src/components/settings/whatsapp/WhatsappTab.tsx`: botón "Probar conexión en vivo" + leyenda de último inbound.
- `src/components/settings/whatsapp/ConnectChannelDialog.tsx`: agregar paso opcional "Probar ahora" después del paso webhook.
- Nuevo componente `LiveTestDialog.tsx` con la UI de espera/checklist.

## Notas técnicas

- El polling es client-side (cada 3 s, max 40 intentos). No requiere Realtime, evita complejidad de canales.
- Normalización de teléfono: quitar `+`, espacios, guiones. Comparar con `last_inbound_from` (Meta entrega ya en formato `525535637687`).
- RLS ya permite a admin del tenant leer `whatsapp_channels`, no hay cambios de policy.
- No se almacena el contenido del mensaje de prueba; solo se observa el timestamp y el remitente.
