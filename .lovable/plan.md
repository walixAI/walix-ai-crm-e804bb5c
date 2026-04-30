## Plan — Retomar onboarding desde donde se quedó

### Problema
Hoy, si el usuario abandona el wizard a mitad (cierra el browser, hace logout, etc.), al volver siempre aparece en **Paso 0** aunque ya tenga datos guardados (nombre, industria, pipeline, WhatsApp…). Hay que detectar el avance real y posicionarlo en el primer paso pendiente.

### Estrategia: persistencia ligera por estado del tenant
No agregamos columnas nuevas. Inferimos el último paso completado a partir de datos ya persistentes:

```text
Paso 0 (negocio)   completado si  profiles.full_name está set Y tenants.industry no es null
Paso 1 (IA pipe)   completado si  existe ≥1 pipeline_stages para el tenant
Paso 2 (WhatsApp)  completado si  tenants.whatsapp_phone IS NOT NULL  (o el usuario marcó "omitir" — ver abajo)
Paso 3 (invites)   completado si  existe ≥1 invitación enviada por este user en este tenant
Paso 4 (final)     se muestra solo si profiles.onboarded = true (en cuyo caso ya redirigimos)
```

El "primer paso pendiente" es el primer paso de la lista que NO esté completado. Si todos están completados pero `onboarded=false` (caso raro), aterriza en Paso 4 para que confirme.

### Manejo de pasos opcionales (WhatsApp e invitaciones)
Estos dos pasos son opcionales — no queremos forzar al usuario a llenarlos para "desbloquear" el siguiente. Solución: usar `localStorage` por usuario como marca de "skipped":

- Key: `walix.onboarding.skipped.<user_id>` → `{ whatsapp: true, invites: true }`
- Se setea cuando el usuario presiona "Omitir" / continúa sin llenar.
- En la detección, paso 2 cuenta como completado si `whatsapp_phone` está set **o** está marcado como skipped.
- Lo mismo para paso 3.
- Al pulsar "Atrás", el skip de ese paso se limpia para que pueda volver a intentar.

Esto evita una migración solo para flags de UI.

### Cambios en `src/pages/Onboarding.tsx`

1. Nueva función `computeResumeStep()` que recibe el estado leído del tenant + skips de localStorage y devuelve `0..4`.
2. Renombrar el `useEffect` de carga inicial:
   - Cargar `profiles` (full_name, onboarded).
   - Cargar `tenants` (todos los campos actuales).
   - Cargar `pipeline_stages` count (`select('id', { count: 'exact', head: true })` filtrando por tenant_id).
   - Cargar `invitations` count (filtrado por `tenant_id` + `invited_by = user.id`).
   - Leer skips de localStorage.
   - Llamar `setStep(computeResumeStep(...))` antes de quitar el loading.
3. Mostrar un toast informativo "Continuamos donde te quedaste" solo si `resumeStep > 0`.
4. En `saveWhatsappAndContinue` cuando `whatsapp_phone` quedó vacío → marcar skip en localStorage. Mismo en `skipInvites`.
5. En el botón **Atrás** (`setStep((s) => Math.max(0, s - 1))`), si volvemos a 2 o 3 limpiamos su skip correspondiente.
6. Mientras `tenantLoading` es true, ya hay un loader implícito (botón disabled); aseguramos que el card no muestre Paso 0 vacío durante ese instante mostrando un `<Loader2>` central.

### Caso límite: `onboarded=true`
Ya hoy redirige a `/dashboard`. Lo dejamos. Si el usuario quiere ver el wizard de nuevo, puede haber un botón en Configuración más adelante (fuera de scope).

### Archivos a tocar
- `src/pages/Onboarding.tsx` — lógica de resume + skips en localStorage + loader inicial.

**Sin cambios de DB.** Sin nuevas dependencias.

¿Procedo?
