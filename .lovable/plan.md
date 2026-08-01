# Refactor del ciclo de vida de Contactos

## Objetivo
Separar claramente dos conceptos:
- **Contacto**: ficha maestra de larga vida con ciclo de vida simple (`Prospecto`, `Cliente`, `Cliente ya inactivo`, `Inactivo`).
- **Deal / Oportunidad**: transacción con etapas configurables por pipeline (`Cotización`, `Visita`, `Ganado`, `Perdido`, etc.).

Eliminar la tabla `contact_stages` y el campo `contacts.stage_id`, que hoy duplican y confunden el estado del contacto con el del pipeline.

## Cambios en base de datos

### 1. Nuevo enum y migración de `contacts.status`
- Crear enum `contact_lifecycle` con valores: `prospecto`, `cliente`, `cliente_inactivo`, `inactivo`.
- Migrar `contacts.status` desde `lead_status` a `contact_lifecycle` usando:
  - `Nuevo`, `Contactado`, `Calificado`, `En negociación` → `prospecto`
  - `Cliente` → `cliente`
  - `Inactivo` → `inactivo`
- Sobreescribir luego con regla por deals: cualquier contacto con al menos un deal `is_won = true` pasa a `cliente`.
- Eliminar enum `lead_status`.

### 2. Configuración por tenant
- Agregar a `public.tenants`:
  - `contact_inactivity_days integer DEFAULT 90` (valores permitidos: 30, 90, 120, 150, 180).
  - `customer_inactivity_months integer DEFAULT 6` (valores permitidos: 3, 6, 9, 12).
- Ambos campos serán editables desde Configuración del tenant.

### 3. Limpieza de `contact_stages`
- Eliminar columna `contacts.stage_id`.
- Eliminar tabla `contact_stages` y sus políticas RLS.
- Actualizar trigger `seed_tenant_contact_catalogs()` para que ya no inserte filas en `contact_stages` (sigue creando `contact_sources`).

## Automatización del ciclo de vida

### 4. Edge function `contact-lifecycle-sync`
Crear `supabase/functions/contact-lifecycle-sync/index.ts` que se ejecuta cada noche:

Para cada contacto, usando los umbrales del tenant:
1. Si tiene al menos un deal ganado → es `cliente`.
2. Si es `cliente` y el último deal ganado fue hace más de `customer_inactivity_months` → `cliente_inactivo`.
3. Si no tiene deals ganados y `last_activity_at` es anterior a `contact_inactivity_days` → `inactivo`.
4. En cualquier otro caso → `prospecto`.

La función respetará cambios manuales: solo aplicará las transiciones automáticas descritas; un usuario puede cambiar el status manualmente en cualquier momento y el job no lo revertirá salvo que vuelva a cumplirse una regla automática.

### 5. Cron job
Programar invocación diaria de `contact-lifecycle-sync` mediante `pg_cron` + `net.http_post` al endpoint de la edge function con service_role.

## Cambios en frontend

### 6. Tipos y utilidades
- Actualizar `src/lib/contacts/badges.ts`: reemplazar `LeadStatus` por `ContactLifecycle` con los 4 estados y sus colores/etiquetas.
- Actualizar `src/lib/queries/contacts.ts`: remover `stageId`, cambiar tipos de `status` y mapear el nuevo enum.
- Eliminar o deprecar `src/lib/queries/contactStages.ts`.

### 7. Vistas de Contactos
- `src/pages/app/Contacts.tsx`: filtros y selectores ahora usan los 4 estados del ciclo de vida.
- `src/components/contacts/ContactsKanban.tsx`: columnas reducidas a `Prospecto`, `Cliente`, `Cliente ya inactivo`, `Inactivo`.
- `src/components/contacts/ChangeStatusPopover.tsx`: opciones del nuevo ciclo de vida.
- Formularios de contacto: quitar selector de etapa; conservar selector de ciclo de vida.

### 8. Configuración del tenant
- `src/pages/app/Settings.tsx` (o pestaña correspondiente): agregar dos selects:
  - "Días para inactivar un prospecto" (30, 90, 120, 150, 180).
  - "Meses para marcar cliente como inactivo" (3, 6, 9, 12).
- Eliminar el editor de etapas de contacto (`StagesEditor`) de la sección de configuración.

### 9. Pipeline
- No se modifica la estructura de `pipelines` ni `pipeline_stages`; se mantienen configurables por tenant.
- Se asegurará que los componentes de Deal no usen `stage_id` del contacto (solo del deal).

## Validación

### 10. Pruebas
- Verificar migración de datos: conteos por nuevo ciclo de vida y que contactos con deals ganados queden como `cliente`.
- Ejecutar `contact-lifecycle-sync` manualmente y confirmar transiciones correctas.
- Revisar que la vista de Contactos, Kanban y filtros rendericen los 4 estados.
- Confirmar que la configuración de umbrales se persista por tenant.

## Notas técnicas
- `contacts.last_activity_at` ya existe y se usa como señal de actividad; el job se basará en él.
- `contacts.source_id` y `contact_sources` se mantienen intactos.
- El tipo `Database["public"]["Enums"]["lead_status"]` en `src/integrations/supabase/types.ts` se regenerará automáticamente tras la migración.