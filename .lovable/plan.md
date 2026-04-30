## Plan aprobado — Onboarding personalizado + selector de país

### A. Personalización real por industria (eliminar lo fijo)

1. **Tags dinámicas por industria** (`onboarding-seed`)
   - Llamar a Lovable AI Gateway pidiendo 6–10 tags específicas de la industria via `tool_choice`.
   - Fallback: 6 tags universales si la IA falla.

2. **Plantillas WhatsApp con nombres dinámicos** (`onboarding-seed`)
   - Quitar los 3 nombres fijos del prompt.
   - La IA decide nombre, categoría y contenido (4–6 plantillas por industria).

3. **Pipeline IA — prompt liberado** (`ai-onboarding-setup`)
   - Recibir `company_name` y usarlo en la `rationale`.
   - Soltar la restricción de paleta cerrada (mantener guía HSL pero permitir variaciones).
   - Mejorar fallback para que use el nombre de la industria.

### B. Selector de país en Paso 0

4. **Nuevo campo "País" en Paso 0** (`Onboarding.tsx`)
   - Select con: México (default), Colombia, Argentina, Chile, Perú, España, Estados Unidos, Otro.
   - Al guardar Paso 0, se actualiza `tenants` con `currency`, `timezone` y `locale` derivados del país:

   ```text
   México        → MXN, America/Mexico_City,  es-MX
   Colombia      → COP, America/Bogota,        es-CO
   Argentina     → ARS, America/Argentina/Buenos_Aires, es-AR
   Chile         → CLP, America/Santiago,      es-CL
   Perú          → PEN, America/Lima,          es-PE
   España        → EUR, Europe/Madrid,         es-ES
   Estados Unidos→ USD, America/Mexico_City,   es-US
   Otro          → USD, America/Mexico_City,   es-419
   ```

   - Mapeo en `src/lib/constants/onboarding.ts` (nuevo).
   - Pre-cargar el país si el tenant ya tiene currency definida (al volver al wizard).
   - El usuario podrá cambiarlo luego en **Configuración → General**.

### C. Arreglos de UX

5. **Sincronizar mensajes de loading con fases reales**
   - `runAi` → "Analizando tu industria…", "Diseñando tu pipeline…"
   - `applyAi` → "Creando etapas…", "Sembrando etiquetas y plantillas…"

6. **Garantizar pipeline default siempre**
   - Si el usuario hace "Omitir" / "Personalizar luego" en Paso 1, crear pipeline a partir del FALLBACK antes de avanzar. Nunca dejar al usuario sin pipeline.

7. **Paso 4 con stats reales**
   - Leer respuesta de `onboarding-seed` (ya devuelve `tags`, `templates`, `automations`) y mostrar conteos reales en las tarjetas finales.

8. **Listas exportadas**
   - Mover `INDUSTRIES`, `TEAM_SIZES`, `SALES_CHANNELS`, `COUNTRIES` y el mapeo país→locale a `src/lib/constants/onboarding.ts` para reutilizar en Configuración.

---

### Archivos a tocar

- **Nuevo**: `src/lib/constants/onboarding.ts` — listas y mapeo país → currency/timezone/locale.
- `src/pages/Onboarding.tsx` — selector de país, persistir currency/timezone/locale, pipeline-default-on-skip, stats reales en Paso 4, mensajes de loading sincronizados, pasar `company_name` a la IA.
- `supabase/functions/ai-onboarding-setup/index.ts` — recibir `company_name`, prompt más libre, fallback con nombre de industria.
- `supabase/functions/onboarding-seed/index.ts` — `generateTagsWithAI(industry)`, plantillas con nombres dinámicos, devolver listado real para mostrar en Paso 4.

**Sin cambios de DB** — `tenants` ya tiene columnas `currency`, `timezone`, `locale`.

¿Procedo a implementar?
