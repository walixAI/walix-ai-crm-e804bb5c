## Plan: rediseño del Wizard de Onboarding

### Resumen de decisiones aprobadas

1. **País / timezone / currency** → siempre MX por defecto (`America/Mexico_City`, `MXN`, `es-MX`). Configurable después en Settings → General (ya existe).
2. **`full_name` y `company_name`** → se piden en el **Paso 0** del wizard, NO en el signup.
3. **Email transaccional** → configurar Lovable Emails para invitaciones del equipo.
4. **Logo / color de marca** → solo en Settings → General (ya existe). NO en wizard.
5. **Sembrar tags y plantillas de WhatsApp** → sí, automático según industria.
6. **Tras finalizar** → llevar al usuario a `/contacts` con un onboarding hint para crear el primer contacto vía IA con prompt sugerido.

---

### Estructura final del wizard (5 pasos)

```text
Paso 0 — Tu cuenta y negocio
  • Nombre completo
  • Nombre de la empresa
  • Industria
  • Tamaño del equipo
  • Canal principal de ventas
  → Persiste en profiles + tenants

Paso 1 — Configura con IA (existente, sin cambios)
  → Aplica pipeline + etapas
  → Siembra tags y plantillas WA en paralelo

Paso 2 — WhatsApp (mejorado)
  • Captura número comercial (E.164, opcional)
  • Banner: "Conecta el chat real desde Configuración → WhatsApp"
  → Persiste tenants.whatsapp_phone

Paso 3 — Invita a tu equipo (mejorado)
  • Hasta 3 emails + rol
  • Genera token + envía email real (Lovable Emails)

Paso 4 — Listo (modificado)
  • Resumen
  • CTA principal: "Crea tu primer contacto" → /contacts?firstRun=1
  • CTA secundario: "Ir al Dashboard"
```

---

### Cambios en base de datos

**Migración SQL:**

```sql
-- Nuevas columnas en tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS sales_channel text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;

-- Token y aceptación en invitations
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);
```

No se modifica `handle_new_user()` — sigue creando "Mi empresa" como placeholder; el Paso 0 lo renombra inmediatamente con `UPDATE tenants SET name = ?, industry = ?, ...`.

---

### Sembrado (server-side, edge function nueva)

**Edge function `onboarding-seed`** (`verify_jwt` por defecto). Recibe `{ tenant_id, industry }` y, en una sola llamada idempotente:

1. Inserta 8 `contact_tags` base por familia:
   - `lifecycle`: Nuevo, Activo, Inactivo
   - `priority`: VIP, Caliente, Frío
   - `special`: Recurrente, Referido
2. Inserta 3 `message_templates` adaptadas a la industria:
   - "Saludo inicial", "Seguimiento 24h", "Cierre / propuesta"
   - El cuerpo se genera con Lovable AI (`google/gemini-2.5-flash`) con prompt corto, con fallback a textos base si falla.
3. Inserta 1 `automation` deshabilitada de ejemplo: "Auto-saludo a nuevo lead WhatsApp" (`enabled=false`, `is_draft=true`).

Se invoca desde `applyAi()` después de crear las etapas, en `Promise.all` con la inserción de stages para no bloquear la UI.

---

### Email de invitaciones

- Configurar Lovable Emails (infraestructura compartida + dominio).
- Edge function `send-invitation` que: valida que el invocador sea admin del tenant, crea/usa el `token`, y encola un email transaccional con link `https://<app>/accept-invite/<token>`.
- Plantilla con branding del tenant (logo + brand_primary leídos de `tenants`).
- Nueva ruta pública `/accept-invite/:token`:
  - Valida token (no expirado, no aceptado).
  - Si el invitado no tiene cuenta → flujo signup; si la tiene → login.
  - Al terminar, hace `UPDATE profiles SET tenant_id, active_tenant_id = ?` y `INSERT INTO user_roles` con el rol asignado, marca `accepted_at` y `accepted_by`.
- En el wizard Paso 3, el botón "Enviar invitaciones" llama a `send-invitation` por cada email válido.

---

### Página de Contactos: primer contacto con IA

- En `Contacts.tsx`, leer `?firstRun=1` desde URL.
- Si está y la lista está vacía, mostrar un **banner empty-state especial** sobre el listado:

```text
┌─────────────────────────────────────────────────────────┐
│ ✨ Crea tu primer contacto con IA                       │
│                                                         │
│ Escribe en lenguaje natural:                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Crea el contacto Juan González con teléfono       │ │
│ │ 5512345678                                          │ │
│ └─────────────────────────────────────────────────────┘ │
│                              [ Crear con IA ]           │
│                                                         │
│ O usa el formulario clásico → [+ Nuevo contacto]        │
└─────────────────────────────────────────────────────────┘
```

- El botón "Crear con IA" llama a una edge function nueva `contacts-ai-create` que:
  - Recibe `{ prompt, tenant_id }`.
  - Usa Lovable AI con tool calling (function `create_contact`) para extraer nombre, apellido, teléfono (normalizado E.164 MX), email, empresa, etiquetas sugeridas.
  - Inserta en `contacts` y devuelve el row creado.
- Tras éxito → toast + scroll/highlight a la nueva fila + descartar el banner.
- El banner también ofrece sugerencias rápidas como chips clicables:
  - "Crea el contacto María López, teléfono 5587654321, empresa Acme"
  - "Agrega a Pedro Ramírez como cliente VIP, 5511223344"

---

### Cambios concretos por archivo

**`src/pages/Login.tsx`**
- Quitar todo lo relacionado con `full_name` / `company_name` (ya no se piden aquí).
- El signup queda con email + password únicamente.

**`src/pages/Onboarding.tsx`** (refactor mayor)
- Renombrar Paso 0 actual ("Tu negocio") → ahora pide también `full_name` y `company_name` arriba, además de industry/team/channel.
- Botón "Continuar" del Paso 0 hace:
  ```ts
  await supabase.from("profiles").update({ full_name }).eq("id", user.id);
  await supabase.from("tenants").update({
    name: company_name,
    industry, team_size, sales_channel
  }).eq("id", tenantId);
  ```
- Después de `applyAi()`, invocar `onboarding-seed` (no bloqueante, con toast en error).
- Paso 2 WhatsApp: agregar Input de teléfono opcional y guardarlo.
- Paso 3: cambiar `insert invitations` por `supabase.functions.invoke("send-invitation", ...)`.
- Paso 4: cambiar CTA principal a "Crear mi primer contacto" → `navigate("/contacts?firstRun=1")`.
- Bloquear botón "Configurar con IA" hasta que `tenantId` esté cargado.

**`src/pages/app/Contacts.tsx`**
- Detectar `?firstRun=1` con `useSearchParams`.
- Renderizar `<FirstContactAIBanner>` si `firstRun && contacts.length === 0`.
- Crear componente nuevo `src/components/contacts/FirstContactAIBanner.tsx`.

**Nuevas edge functions**
- `supabase/functions/onboarding-seed/index.ts`
- `supabase/functions/send-invitation/index.ts`
- `supabase/functions/contacts-ai-create/index.ts`

**Nueva ruta**
- `src/pages/AcceptInvite.tsx` + entrada en `App.tsx` como ruta pública.

**Email infrastructure**
- Setup de Lovable Emails con dominio (requiere que el usuario complete el diálogo de configuración de dominio).
- Plantilla transaccional para invitaciones.

---

### Flujo completo del usuario nuevo

```text
1. /login?mode=signup
   email + password
   ↓ (trigger crea org/tenant placeholder)
2. /onboarding · Paso 0
   nombre + empresa + industria + equipo + canal
   → UPDATE profiles + tenants
3. /onboarding · Paso 1
   IA genera pipeline → applyAi()
   → INSERT pipelines + pipeline_stages
   → invoke onboarding-seed (tags + plantillas + automation demo)
4. /onboarding · Paso 2
   teléfono WhatsApp opcional → tenants.whatsapp_phone
5. /onboarding · Paso 3
   invitaciones → invoke send-invitation por email
6. /onboarding · Paso 4
   "Crear mi primer contacto" → /contacts?firstRun=1
7. /contacts?firstRun=1
   Banner IA con prompt de ejemplo
   Usuario escribe → invoke contacts-ai-create
   → INSERT contacts → toast + highlight
```

---

### Detalles técnicos clave

- Las edge functions nuevas validan el JWT en código y leen `tenant_id` desde `profiles` del invocador (no confían en el body).
- `contacts-ai-create` usa tool calling con schema estricto:
  ```json
  { "name": "string", "last_name": "string?", "phone": "string (E.164)",
    "email": "string?", "company": "string?", "tags": "string[]" }
  ```
- Normalización MX: si el teléfono empieza con 10 dígitos, prepend `+52`.
- `onboarding-seed` es idempotente: usa `ON CONFLICT DO NOTHING` con un índice único compuesto en `(tenant_id, name)` para tags y plantillas (requiere agregar el índice en la migración).
- Token de invitación se valida server-side en `accept-invite` con SECURITY DEFINER function que también escribe `user_roles`, para evitar problemas de RLS.

---

### Orden de implementación

1. Migración SQL (columnas + tokens + índices únicos).
2. Refactor `Login.tsx` (limpieza).
3. Refactor `Onboarding.tsx` (Paso 0 ampliado + persistencia + CTA final).
4. Edge function `onboarding-seed` + invocación en `applyAi`.
5. Setup Lovable Emails + edge function `send-invitation` + plantilla.
6. Página `/accept-invite/:token` + RPC SECURITY DEFINER para aceptar.
7. Edge function `contacts-ai-create`.
8. Banner `FirstContactAIBanner` en `Contacts.tsx` con `?firstRun=1`.
9. QA del flujo completo end-to-end.
