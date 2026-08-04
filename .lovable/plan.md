# Automatizaciones: motor real + plantillas de lo que ya construimos

## Situación actual (verificada)

- La tabla `automations` existe con RLS y la UI completa (galería, builder, borrador con IA, historial, simulación).
- La lista está vacía porque nada crea automatizaciones: `onboarding-seed` sólo inserta una demo ("Auto-saludo a nuevo lead") en borrador, con un `trigger_type` que ni siquiera existe en el catálogo de la UI.
- **No existe ninguna función que ejecute automatizaciones**: no hay edge function tipo runner ni cron. Hoy, aunque el usuario active una, no pasa nada.
- Sí existen mecanismos separados que hacen trabajo automático fuera del módulo: reglas de etapa (`pipeline_stage_rules`), sincronización de ciclo de vida de contactos, marcado de deals en silencio, gastos recurrentes y agentes IA.

## Qué haremos

### 1. Motor de ejecución (lo que falta de fondo)
Nueva edge function `automations-run` que:
- Recibe eventos reactivos (deal ganado/perdido, cambio de etapa, contacto nuevo, lead nuevo de WhatsApp).
- Corre por cron cada 30 minutos los triggers programados (deal inactivo, cierre próximo, contacto sin responder).
- Evalúa condiciones, ejecuta acciones (notificar, crear tarea, etiquetar, reasignar, mover etapa, enviar WhatsApp) y registra cada corrida en `automation_runs` (modo `live` o `dry`).
- Respeta el límite de automatizaciones activas por plan y evita duplicados (no repetir la misma acción sobre la misma entidad el mismo día).

### 2. Plantillas nuevas basadas en lo que ya implementamos
Se agregan al catálogo de la galería, en español y listas para activar con un clic:
- **Cobranza atrasada**: pago vencido X días → tarea "Seguir cobrando" + aviso al responsable.
- **Deal en silencio**: deal marcado como silencioso → notificar y pedir diagnóstico de bloqueo.
- **Bloqueo por precio sin resolver**: bloqueo activo de tipo precio con más de 7 días → aviso al gerente.
- **Meta del mes en riesgo**: run rate por debajo del umbral a media o fin de mes → aviso al vendedor y al admin.
- **Gasto recurrente por confirmar**: gasto del mes generado y sin confirmar → tarea al admin.
- **Conversación de WhatsApp por responder**: mensaje del cliente sin respuesta X horas, con aviso si la ventana de 24 h está por cerrarse.
- **Contacto a punto de volverse inactivo**: faltan pocos días para el umbral → tarea de reactivación.
- **Cliente sin recompra**: cliente cerca del umbral de "cliente inactivo" → tarea de seguimiento.

### 3. Arranque para tenants existentes
- Reemplazar la demo rota de `onboarding-seed` por un set de 3 plantillas recomendadas creadas como **borrador pausado** (nada se ejecuta sin que el usuario lo active).
- En la pantalla vacía, mostrar directamente las plantillas recomendadas en lugar de sólo un botón.

## Detalles técnicos

- Nuevos triggers en `src/lib/automations/registry.ts`: `payment_overdue`, `deal_silent`, `blocker_unresolved`, `goal_at_risk`, `recurring_expense_pending`, `whatsapp_awaiting_reply`, `contact_going_inactive`, `client_no_repurchase`.
- Nuevas plantillas en `src/lib/automations/templates.ts` con los mismos `triggerType`/`actions` que entiende el runner.
- `supabase/functions/automations-run/index.ts` con dos modos: `{ mode: "event", event, payload }` y `{ mode: "cron" }`; cron programado con `pg_cron` + `pg_net` en una migración.
- Disparadores reactivos: triggers SQL ligeros que encolan el evento (mismo patrón que `notify_ai_context_updater`), para no bloquear las escrituras.
- Cada acción escribe en `automation_runs` y actualiza `run_count`, `last_run_at`, `error_count`, `last_error`.
- La simulación existente en la UI llamará al runner con `mode: "dry"` para mostrar qué haría sin ejecutar nada.

## Fuera de alcance
- No se migran las reglas de etapa ni los agentes IA al módulo de automatizaciones; siguen donde están.