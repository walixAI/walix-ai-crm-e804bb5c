
# Módulo de Automatizaciones (/automations)

## Sugerencias clave de UX (lo que añado a tu prompt)

Estas son decisiones que harán la diferencia entre una página "bonita" y una herramienta que un dueño de Tacos El Güero use sin manual:

1. **Galería de plantillas como punto de entrada principal.** En vez de empezar con "+ Nueva Automatización" en blanco, el botón principal abre un selector con ~8 plantillas listas ("Bienvenida a nuevo contacto", "Recordar deal frío", "Asignar lead a vendedor con menos carga"…). Crear desde cero es la opción avanzada (link discreto). Esto reduce el time-to-first-automation de minutos a 15 segundos.
2. **Lenguaje natural en toda la UI, no jerga técnica.** En lugar de "trigger / condición / acción" mostramos:
   - **CUANDO pase esto…** (trigger)
   - **SOLO SI…** (condición opcional, oculta por default)
   - **HAZ ESTO…** (acción)
3. **Vista previa en tiempo real ("Así se vería").** En el paso final, una tarjeta narrativa: *"Cuando llegue un nuevo lead de WhatsApp, si la fuente es Facebook Ads, asignar a Carlos Méndez y enviar plantilla 'Bienvenida'"*. Editable por chips clicables.
4. **Modo Simulación (dry-run) antes de activar.** Botón "Probar con datos reales" muestra a qué deals/contactos de los últimos 7 días se les habría aplicado la automatización, sin ejecutarla. Quita el miedo a "qué pasa si la prendo".
5. **Historial de ejecuciones por automatización.** Tab dentro de cada card que muestra las últimas 20 ejecuciones (timestamp, qué entidad, éxito/error). Da confianza y debugging.
6. **Asistente IA "Crear con lenguaje natural".** Botón secundario donde el usuario escribe *"avísame cuando un cliente lleve 3 días sin contestarme un WhatsApp"* y la IA pre-rellena el builder. Reusa `lovable-ai-gateway`.
7. **Pausas inteligentes (anti-spam).** Setting global "no enviar mensajes WA entre 22:00 y 08:00" y "máximo 1 mensaje automático por contacto cada 24h". Evita quemar la relación con clientes.
8. **Etiqueta "Recomendado para ti"** en plantillas relevantes según el estado actual del CRM (ej. si tienen 5+ deals estancados, recomendar "Alerta deal estancado" arriba).
9. **Toggle Activa/Pausada con confirmación si afecta muchos.** Si una automatización ya tiene 50+ ejecuciones, al pausar mostrar mini-modal "Esto detendrá X envíos programados".
10. **Builder como Sheet lateral**, no modal de pantalla completa ni página propia. Mantiene el contexto de la lista visible y se cierra fácil.

## Estructura de la página

```text
/automations
├─ Header
│  ├─ "Automatizaciones" + sub: "Pon tu CRM en piloto automático"
│  ├─ Contador de plan: "2 de 3 usadas · Plan Pro"  (pill)
│  └─ [+ Nueva automatización]  → abre Galería
│
├─ Banner "Empieza rápido" (solo si 0 automatizaciones)
│  └─ 3 plantillas destacadas en cards grandes con CTA "Activar en 1 clic"
│
├─ Tabs: Activas (4) · Pausadas (2) · Borradores (1) · Todas
│  └─ Filtro lateral: "por trigger" · "por última ejecución"
│
└─ Grid de cards (1 col mobile, 2 col tablet, 3 col desktop)
   └─ AutomationCard
      ├─ Icono + nombre + descripción narrativa de 1 línea
      ├─ Badge estado (Activa verde / Pausada gris / Error rojo / Borrador)
      ├─ Stats: "Ejecutada 23 veces · Última hace 2h · 91% éxito"
      ├─ Mini gráfico sparkline de ejecuciones últimos 7 días
      ├─ Toggle Activa/Pausada (con confirm si tiene muchos runs)
      └─ Menu (⋯): Editar · Ver historial · Duplicar · Eliminar
```

## Builder (Sheet lateral, ~600px ancho)

5 pasos con stepper visible. Botón "Anterior" y "Siguiente" abajo, "Guardar como borrador" siempre disponible.

```text
Paso 1 — Información
   nombre + descripción opcional + icono (auto-sugerido)

Paso 2 — CUANDO pase esto (trigger)
   Cards de selección, una activa a la vez:
   ⏰ Deal sin actividad por [N] días
   📱 Llega nuevo lead de WhatsApp
   👤 Se crea un contacto nuevo
   📊 Deal se mueve [de etapa] → [a etapa]
   ✅ Deal marcado como Ganado
   ❌ Deal marcado como Perdido
   📅 Fecha de cierre se acerca en [N] días
   💬 Contacto sin respuesta hace [N] días  (extra sugerido)

Paso 3 — SOLO SI (condición opcional)
   Toggle "Agregar filtro"
   Builder visual: [campo] [operador] [valor]
   Soporta hasta 3 condiciones con AND/OR
   Campos: monto deal, vendedor, fuente, etiqueta contacto, etapa, etc.

Paso 4 — HAZ ESTO (acción)
   📲 Enviar mensaje WhatsApp [plantilla]
   🔔 Notificar al vendedor (in-app + email)
   📋 Crear tarea
   👥 Reasignar contacto (vendedor o round-robin)
   🏷️ Agregar etiqueta
   📊 Mover deal a etapa
   ⚡ Encadenar otra acción (botón "+ otra acción")

Paso 5 — Revisar y activar
   Tarjeta narrativa: "CUANDO ... SOLO SI ... ENTONCES ..."
   Botón [Probar con datos reales] → muestra dry-run
   Toggle activar al guardar
   Botón [Guardar y activar]
```

Al inicio del Sheet, banner discreto: *"¿Prefieres describirla? [Crear con IA →]"* abre un input de texto libre.

## Plantillas pre-cargadas (galería)

Mismas que pediste + 4 sugeridas:

| # | Nombre | Trigger | Acción | Estado default |
|---|---|---|---|---|
| 1 | Recordatorio de seguimiento | Deal sin actividad N días | Notificar vendedor | Activa |
| 2 | Asignación automática de leads | Nuevo lead WhatsApp | Round-robin entre vendedores | Activa |
| 3 | Mensaje de bienvenida | Nuevo contacto | Enviar plantilla WA | Pausada (necesita plantilla) |
| 4 | Alerta deal estancado | Deal sin avanzar 10 días | Notificar gerente | Activa |
| 5 | Felicitar al ganar | Deal marcado Ganado | Tarea de seguimiento + WA agradecimiento | Borrador |
| 6 | Recuperar deal perdido | Deal marcado Perdido | Tarea de revisión a 30 días | Borrador |
| 7 | Recordar cierre próximo | Fecha cierre en 3 días | Notificar vendedor + tarea | Borrador |
| 8 | Re-engage cliente frío | Sin mensaje WA hace 14 días | Plantilla "te extrañamos" | Borrador |

## Gating por plan

Lee `tenant.plan` (mock actualmente: "Pro"). Mapeo:

- **Starter:** ver todas, activar 0. Cards bloqueadas con candado y badge *"Disponible en plan PyME"*. CTA "Mejorar plan".
- **PyME / Pro:** máximo 3 activas. Pill "2 de 3 usadas". Al intentar activar la 4ª → modal upsell.
- **Growth / Enterprise:** ilimitadas, sin pill de límite.

## Detalles técnicos

### Backend (Lovable Cloud)

Dos tablas nuevas vía migración:

**`automations`** — definición de la regla
- `id`, `tenant_id`, `name`, `description`, `icon`, `enabled` (bool)
- `trigger_type` (enum), `trigger_config` (jsonb)
- `conditions` (jsonb: array de `{field, operator, value, logic}`)
- `actions` (jsonb: array de `{type, config}`)
- `created_by`, `created_at`, `updated_at`, `last_run_at`, `run_count`, `error_count`
- RLS: tenant-scoped (mismo patrón que `deals`).

**`automation_runs`** — historial
- `id`, `automation_id`, `tenant_id`, `entity_type`, `entity_id`
- `status` (success | error | dry_run), `error_message`, `payload` (jsonb), `created_at`
- RLS: tenant-scoped, solo SELECT/INSERT.

### Edge Functions

- **`automations-evaluate`** — endpoint invocable manualmente (dry-run) y por cron. Acepta `{automationId, mode: "dry"|"live"}`. Recorre entidades candidatas, evalúa condiciones en JS, ejecuta acciones (insert tasks, update deals, send WA via webhook futuro, notificar). Registra cada paso en `automation_runs`.
- **`automations-ai-draft`** — recibe texto en lenguaje natural, devuelve borrador JSON del builder usando `google/gemini-2.5-flash` (rápido y barato).
- **Cron pg_cron** cada 15 min llama a `automations-evaluate` para cada automatización activa con triggers basados en tiempo (deal sin actividad, fecha cierre próxima). Triggers reactivos (nuevo lead, deal movido) se ejecutan vía hooks en mutaciones existentes (`useCreateContact`, `useMoveDeal`).

### Frontend

```text
src/pages/app/Automations.tsx                  página principal con tabs y galería
src/components/automations/
  AutomationCard.tsx                           card individual con sparkline
  AutomationTemplateGallery.tsx                grid de plantillas
  AutomationBuilderSheet.tsx                   Sheet con stepper de 5 pasos
  steps/
    Step1Info.tsx
    Step2Trigger.tsx
    Step3Conditions.tsx
    Step4Actions.tsx
    Step5Review.tsx
  AutomationDryRunDialog.tsx                   muestra resultados de simulación
  AutomationHistoryDrawer.tsx                  últimas 20 ejecuciones
  AutomationAiDraftDialog.tsx                  input de lenguaje natural
  PlanLimitBanner.tsx                          contador y upsell
src/lib/queries/automations.ts                 useAutomations, useCreateAutomation, useDryRun, useToggle…
src/services/automations.ts                    fetch a edge functions
src/lib/automations/templates.ts               las 8 plantillas como datos
src/lib/automations/registry.ts                catálogos de triggers/acciones/operadores con metadata UI
```

Reemplazo de `<Route path="/automations" element={<Stub …/>} />` por el componente real.

### Sin cambios destructivos

- No se toca ninguna tabla existente.
- El cron y los hooks reactivos solo se activan si hay automatizaciones activas (no impacto en perf).
- Plantillas mock primero, ejecución real en una segunda fase si el alcance lo requiere.

## Alcance de esta entrega

**Incluido en esta iteración:**
- Página completa con galería, lista, tabs y filtros
- Builder Sheet de 5 pasos funcional
- 8 plantillas pre-cargadas (datos)
- Migración de tablas + RLS
- CRUD completo (crear, editar, duplicar, pausar, eliminar) con persistencia
- Dry-run para triggers basados en consulta SQL (deal sin actividad, fecha cierre próxima)
- Gating por plan (visual + bloqueo)
- Vista de historial (lectura)
- Asistente IA opcional (botón visible, edge function lista)

**Fuera de alcance (siguiente iteración):**
- Ejecución real cron + hooks reactivos en mutaciones (queda la edge function preparada pero sin programar)
- Envío real de mensajes WhatsApp (depende de integración WA externa)
- Encadenamiento de múltiples acciones (UI lista pero solo 1 acción ejecutable por ahora)

¿Procedo con esta implementación o quieres ajustar algo? Un par de preguntas si tienes preferencia: ¿el Builder lo prefieres como Sheet lateral (mi recomendación) o como página dedicada `/automations/new`? ¿Activo el botón "Crear con IA" en esta entrega o lo dejo para después?
