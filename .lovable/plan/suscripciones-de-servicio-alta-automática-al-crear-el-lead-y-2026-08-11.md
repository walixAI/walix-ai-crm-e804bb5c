# Suscripciones de servicio: alta automática al crear el lead y re-agenda al ganar

## Estado actual (verificado)

- Existen 4 recurrencias activas (Mantenimiento semestral/anual, Cambio de filtro semestral/anual) con horizonte de 2 citas futuras y 5 días de anticipación.
- Las oportunidades ya tienen **Frecuencia del servicio** (`service_frequency_months`): 39 con frecuencia en Refrigeración G&R, de las cuales **4 no están ligadas a ninguna recurrencia** (creadas a mano).
- Hoy la cadena sólo se cierra si el deal nació de una ocurrencia: al ganar un lead creado manualmente no se crea suscripción ni siguiente cita.
- Las categorías (Mantenimientos, Cambio de filtro) no tienen forma de marcarse como "de suscripción".

## Lo que propongo

### 1. Categorías de suscripción
En Ajustes, cada categoría de producto puede marcarse como **"Servicio recurrente"** con una periodicidad sugerida (Trimestral / Semestral / Anual). Se marcan "Mantenimientos" y "Cambio de filtro". Así Walix sabe qué leads son de suscripción sin adivinar por el título.

### 2. Alta automática al crear el lead
Al crear (o editar) una oportunidad de una categoría recurrente con frecuencia definida:
- se crea automáticamente la **suscripción** del contacto a la recurrencia que corresponde (semestral o anual),
- si el contacto ya tiene una suscripción a ese servicio, no se duplica: se actualiza la periodicidad,
- la suscripción queda **activa indefinidamente** hasta que alguien la dé de baja a mano.

Se agrega estado a la suscripción: **Activa / Pausada / Dada de baja**, con motivo y fecha. Sólo las activas generan agenda.

### 3. Al ganar, se crean los siguientes leads con sus tareas
La oportunidad ganada **nunca se reutiliza ni se reabre**: queda como historial del ciclo realizado (fecha, monto, responsable). Al pasar a **Ganado**:
- se marca ejecutada la ocurrencia de ese mes y se cierra su tarea,
- se crean **nuevas oportunidades futuras** (+3, +6 o +12 meses según la periodicidad), cada una con su tarea/agenda de aviso,
- si el lead se creó a mano y no tenía suscripción, primero se crea la suscripción con base en la fecha de cierre y luego se programan las siguientes citas.

Aparece la confirmación "Siguientes servicios: feb 2027 y ago 2027", con opción de ajustar el mes.

### 3b. Al perder, la recurrencia continúa
Perder significa que ese ciclo no se vendió, no que el cliente se dio de baja:
- la oportunidad perdida se conserva como historial con su motivo,
- la suscripción **sigue activa** y se programa igualmente el siguiente ciclo con su tarea,
- la baja sólo ocurre cuando el usuario la marca a mano (estado "Dada de baja" con motivo y fecha); el diálogo de pérdida ofrece un acceso directo para hacerlo.

### 4. Vista mensual "Suscripciones por gestionar"
Una sola pantalla (pestaña Agenda en Automatizaciones + widget en Mi Día) que por mes muestra: contacto, servicio, periodicidad, mes que le toca, estado (Pendiente / Avisado / Agendado / Ejecutado / No procede) y la oportunidad ligada. Con filtros por servicio y responsable, y acciones rápidas: marcar ejecutado, reprogramar, dar de baja.

### 5. Puesta al día
- Alta de suscripción para las 4 oportunidades con frecuencia que hoy no tienen recurrencia.
- Verificación de que cada contacto con suscripción activa tenga 2 citas futuras.

## Detalles técnicos

- `product_categories`: nuevas columnas `is_recurring boolean default false` y `default_period_months int`.
- `recurrence_subscriptions`: nuevas columnas `status text default 'active'` ('active' | 'paused' | 'cancelled'), `cancelled_at`, `cancel_reason`. Todas las consultas del motor filtran `status = 'active'`.
- Función `ensure_recurrence_subscription(_deal_id)`: resuelve recurrencia por (tenant, servicio de la categoría, `service_frequency_months`), crea la suscripción si falta, fija `next_due_date`, y devuelve el id. Se llama por trigger `AFTER INSERT OR UPDATE OF product_category_id, service_frequency_months ON deals`.
- `close_recurrence_from_deal(_deal_id)` se amplía: si no hay ocurrencia ligada, llama a `ensure_recurrence_subscription` con base en `closed_at` y luego a `recurrence_fill_horizon`.
- Trigger de `deals` en `is_won` / `is_lost`: `is_won` marca la ocurrencia `executed`, `is_lost` la marca `lost` con el motivo. **Ambos** llaman a `recurrence_fill_horizon` mientras la suscripción esté `active`; sólo `cancelled` detiene la generación.
- Historial: los deals pasados nunca se editan ni se reciclan; cada ciclo es un deal nuevo ligado a su ocurrencia (`generated_deal_id`) y se muestra como línea de tiempo del servicio en la ficha del contacto.
- `automations-run` sigue generando oportunidades y tareas sólo dentro de la ventana de anticipación; las citas más lejanas quedan como agenda.
- Frontend: selector "Servicio recurrente + periodicidad" en la administración de categorías, bloque de suscripción con estado y botón "Dar de baja" en la ficha del contacto y en `DealDrawer`, y vista mensual reutilizando `MonthlyServicesView` con el filtro de estado de suscripción.

## Orden de entrega
1. Marcado de categorías recurrentes y estado de suscripción.
2. Alta automática al crear/editar el lead.
3. Nuevos leads + tareas al ganar (incluye leads manuales) y continuidad al perder.
4. Vista mensual de suscripciones por gestionar.
5. Puesta al día de los datos existentes.
