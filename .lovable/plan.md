
# Fase 1 — Wizard BYO-WABA con auto-descubrimiento

Reemplazar el `ConnectChannelDialog` actual por un wizard de 4 pasos que pide **solo el System User Token** al tenant y descubre automáticamente WABAs, números, suscribe el webhook y envía un mensaje de prueba.

## Flujo del nuevo wizard

```text
Paso 1 — Compartir WABA con Walix
  Instrucciones + botón "Abrir Business Settings"
  (link directo: business.facebook.com/settings/whatsapp-business-accounts
   ?business_id=...&app_id=2488795184889996)

Paso 2 — Pegar System User Token
  Input único (password) + botón "Descubrir mis cuentas"
  → llama edge function whatsapp-discover-waba

Paso 3 — Seleccionar número
  Lista visual: [WABA] → [+52 55 ... · Verified Name · Quality: GREEN]
  Radio buttons. Muestra status (CONNECTED / FLAGGED / RESTRICTED) por número.

Paso 4 — Confirmar y probar
  - Suscribe webhook automáticamente (POST /{waba-id}/subscribed_apps)
  - Registra número en Cloud API (POST /{phone-id}/register con PIN)
  - Envía mensaje "hello_world" template al propio número del tenant
  - Guarda canal en whatsapp_channels con status='connected'
```

## Archivos a crear/modificar

### Nuevos
- `supabase/functions/whatsapp-discover-waba/index.ts` — recibe `{ token }`, valida con `GET /debug_token`, llama `GET /me/businesses` → `/owned_whatsapp_business_accounts` → `/phone_numbers?fields=display_phone_number,verified_name,quality_rating,code_verification_status,id`. Devuelve árbol `{ businesses: [{ id, name, wabas: [{ id, name, phones: [...] }] }] }`. Sin tocar DB.
- `supabase/functions/whatsapp-connect-discovered/index.ts` — recibe `{ token, waba_id, phone_number_id, kind }`. Valida rol admin/owner. Hace: `subscribed_apps` POST + `phone/register` (best-effort) + `GET /{phone-id}` metadata + envía template `hello_world` + upsert `whatsapp_channels`.
- `src/components/settings/whatsapp/ByoWabaWizard.tsx` — wizard 4 pasos con `useState` step, llama las dos edge functions vía `supabase.functions.invoke`.
- `src/lib/queries/whatsappDiscovery.ts` — hooks `useDiscoverWaba()` y `useConnectDiscovered()`.

### Modificados
- `src/components/settings/whatsapp/WhatsappTab.tsx` — reemplazar botón "Conexión manual" para abrir `ByoWabaWizard` en lugar de `ConnectChannelDialog`. Mantener `ConnectChannelDialog` como fallback "modo avanzado".
- `src/components/settings/whatsapp/EmbeddedSignupButton.tsx` — cambiar copy a "Disponible cuando Meta apruebe Walix como TP" y deshabilitar (no eliminar el código).

## Detalle técnico edge functions

### `whatsapp-discover-waba`
```text
POST { token: string }
1. auth: Authorization header → validar usuario y rol admin/owner del tenant
2. GET https://graph.facebook.com/v21.0/debug_token?input_token={token}&access_token={APP_ID}|{APP_SECRET}
   → verifica que el token tiene scope whatsapp_business_management
   → si no, return 400 { error: "missing_scope", required: [...] }
3. GET /me/businesses?fields=id,name
4. Para cada business: GET /{id}/owned_whatsapp_business_accounts?fields=id,name,currency,timezone_id
   + GET /{id}/client_whatsapp_business_accounts (WABAs compartidas con Walix)
5. Para cada WABA: GET /{waba_id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status
6. Devolver árbol completo. Cachear en memoria 60s por seguridad.
```

### `whatsapp-connect-discovered`
```text
POST { token, waba_id, phone_number_id, kind: "clients" | "team" }
1. auth + rol admin/owner
2. POST /{waba_id}/subscribed_apps  (con token)
3. POST /{phone_number_id}/register { messaging_product: "whatsapp", pin: random6 }
   - Si error code 133006 ("already registered") → continuar
4. GET /{phone_number_id}?fields=display_phone_number,verified_name
5. POST /{phone_number_id}/messages { to: display_phone_number, type: "template",
   template: { name: "hello_world", language: { code: "en_US" } } }
   - Si falla por opt-in/template no aprobado → guardar canal pero status='connected_no_test'
6. Upsert en whatsapp_channels igual que whatsapp-embedded-signup actual
   (provider: 'byo_waba_discovery')
7. Return { ok, channel_id, phone_number, verified_name, test_message_sent: boolean }
```

## UI del wizard (resumen)

- Paso 1: Card con 3 sub-pasos numerados + screenshot ilustrativo + botón externo. Checkbox "Ya compartí la WABA con Walix" para habilitar "Siguiente".
- Paso 2: Input password + link "¿Cómo genero un System User Token?" (abre drawer con guía). Loading spinner durante discovery. Errores claros: `missing_scope` → mostrar qué permisos faltan; `invalid_token` → reintentar.
- Paso 3: Acordeón por Business Manager → WABA → lista de números con badges de calidad (verde/amarillo/rojo). Si solo hay 1 número, autoselección.
- Paso 4: Stepper visual de las 4 operaciones (suscribir / registrar / metadata / mensaje prueba) con check por cada una completada.

---

# Fase 3 — Plan de OAuth Facebook + selector (para cuando Meta apruebe)

Esto NO se implementa ahora. Es la guía paso a paso para activarlo cuando llegue la aprobación.

## Trámites en Meta (haces tú, fuera de código)

### 1. Solicitar Advanced Access de 3 permisos
En `developers.facebook.com` → App `2488795184889996` → App Review → Permissions and Features:

| Permiso | Justificación que debes escribir | Material requerido |
|---|---|---|
| `business_management` | "Allow Walix users to select which Business Manager contains their WhatsApp Business Account during onboarding" | Video 1-2 min mostrando el flujo OAuth → selector → conexión |
| `whatsapp_business_management` | "List WABAs and phone numbers owned by the user so they can pick which one to connect to Walix CRM" | Mismo video |
| `whatsapp_business_messaging` | "Send WhatsApp messages on behalf of the connected business from the Walix CRM interface" | Video enviando un mensaje desde la app |

Plataforma de prueba: marcar **Web** con dominio `walix-ai-crm.lovable.app`.

Tiempo típico: 3-10 días hábiles. NO requiere ser TP.

### 2. Configurar Facebook Login en la app de Meta
- Productos → Facebook Login for Business → Settings
- Valid OAuth Redirect URIs: `https://walix-ai-crm.lovable.app/auth/meta/callback`
- Allowed Domains for the JavaScript SDK: `walix-ai-crm.lovable.app`
- Crear una **Configuration** (no la de Embedded Signup, una nueva de tipo "General"):
  - Permissions: `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging`
  - Guardar el `config_id` resultante como secret `META_OAUTH_CONFIG_ID`.

## Implementación en código (cuando Meta apruebe)

### Nuevos archivos
- `supabase/functions/whatsapp-oauth-callback/index.ts` — recibe `code` en query, intercambia por user_access_token vía `GET /oauth/access_token`, luego llama internamente al mismo flujo de `whatsapp-discover-waba` con ese token, guarda token temporal en `whatsapp_oauth_sessions` (tabla nueva, TTL 10 min) y redirige a `/settings?tab=whatsapp&oauth_session={id}`.
- `src/lib/whatsapp/metaOauthSelect.ts` — `launchFacebookLogin()`: usa el mismo `FB.login` que `metaEmbedded.ts` pero con scopes en vez de `config_id` de Embedded Signup:
  ```text
  scope: 'business_management,whatsapp_business_management,whatsapp_business_messaging',
  config_id: META_OAUTH_CONFIG_ID (opcional, mejora UX),
  response_type: 'code',
  ```

### Tabla nueva (migration en Fase 3)
```sql
CREATE TABLE whatsapp_oauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  access_token text NOT NULL,    -- encriptado o con TTL corto
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  consumed_at timestamptz
);
-- RLS: solo el dueño puede leer su sesión
```

### Modificación al wizard de Fase 1
- Añadir botón al principio: "Conectar con Facebook" (visible solo si `META_OAUTH_CONFIG_ID` está set).
- Si el usuario lo usa: salta Paso 1 y Paso 2, va directo a Paso 3 con el árbol descubierto vía OAuth token.
- Si el usuario prefiere: sigue con el flujo manual con System User Token.

### Manejo del problema "token de usuario expira"
Dos opciones para Fase 3:
- **Opción A (recomendada)**: tras el OAuth y selección, pedir al cliente que también genere un System User Token para almacenamiento permanente (UI lo hace fácil con instrucciones). El OAuth solo se usa para el selector visual; el envío de mensajes usa el System User Token.
- **Opción B**: usar el long-lived user token (60 días) y refrescar con re-OAuth periódico vía notificación. Más fricción, mejor UX inicial.

---

# Orden de ejecución

1. ✅ Apruebas este plan → implemento Fase 1 (wizard + 2 edge functions + UI).
2. 🟡 Tú envías Fase 2 (App Review en Meta) — sin tocar código.
3. ⏳ Cuando Meta apruebe → me dices y arrancamos Fase 3 (otro plan separado).

## Lo que NO toca este plan
- `whatsapp-embedded-signup/index.ts` se queda como está.
- `whatsapp-webhook/index.ts` no se modifica.
- Secretos: no se piden nuevos (`META_OAUTH_CONFIG_ID` se agregaría solo en Fase 3).
