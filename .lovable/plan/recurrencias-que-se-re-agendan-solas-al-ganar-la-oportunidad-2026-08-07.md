# Recurrencias que se re-agendan solas al ganar la oportunidad

## Cómo funciona hoy (verificado)

- Existen 4 recurrencias activas con 282 suscripciones: Mantenimiento semestral (130), Cambio de filtro semestral (25), Mantenimiento anual (43), Cambio de filtro anual (84). Cada una crea oportunidad + tarea con 5 días de anticipación.
- **El motor no se entera cuando la oportunidad se gana.** Hay 35 ocurrencias con el deal ya en Ganado pero la recurrencia sigue en "pendiente", así que su siguiente ciclo nunca se programó.
- **No existe horizonte de 2 ciclos.** Sólo se genera la ocurrencia inmediata: hoy hay 115 ocurrencias futuras para 282 suscripciones, la mayoría de clientes no tiene ninguna cita futura visible.
- **Los campos personalizados que mencionas no existen.** El único campo personalizado configurado es "Modelo de equipo"; la periodicidad hoy sólo vive dentro de la recurrencia, no se ve en la ficha del contacto.

## Lo que se va a construir

### 1. Periodicidad visible en la ficha del contacto
Se crean dos campos personalizados: **Periodo de recurrencia mantenimiento** y **Periodo de recurrencia cambio de filtro**, con opciones Trimestral / Semestral / Anual / Sin recurrencia. Se llenan automáticamente con la suscripción real del contacto (las 282 existentes quedan con su valor correcto) y se mantienen sincronizados: si alguien cambia el campo en el contacto, la recurrencia se ajusta, y viceversa.

### 2. Horizonte permanente de 2 citas futuras
Walix garantiza que cada contacto siempre tenga **2 ocurrencias futuras por servicio** (una de mantenimiento y una de cambio de filtro, según lo que tenga contratado). Si ya hay 2 en el futuro, no crea más; si hay menos, completa hasta llegar a 2.

### 3. Al ganar la oportunidad se re-agenda automáticamente
Cuando el vendedor pasa a **Ganado** una oportunidad de servicio recurrente:
- la ocurrencia de ese mes se marca **Ejecutada** con la fecha y el monto cobrado,
- se cierra la tarea de seguimiento,
- se **rellena el horizonte**: se programan las siguientes citas hasta volver a tener 2 futuras (+3, +6 o +12 meses según la periodicidad del contacto), cada una al día 1 de su mes y con su tarea de aviso.

Aparece una confirmación con las próximas fechas ("Siguientes servicios: feb 2027 y ago 2027") y opción de ajustar el mes o de no re-agendar si el cliente ya no continúa.

### 4. Perdido no re-agenda
Si la oportunidad se marca **Perdida**, la ocurrencia queda como "No procede" con el motivo y no se rellena el horizonte; se pregunta si se conserva la suscripción para el siguiente ciclo o se da de baja.

### 5. Puesta al día de los datos actuales
- Se regularizan las 35 oportunidades ya ganadas cuya recurrencia quedó pendiente.
- Se completa el horizonte de 2 citas futuras para las 282 suscripciones, sin duplicar oportunidades ya existentes.

Todo esto es configuración por tenant: sólo aplica a quien tenga recurrencias definidas; los demás tenants no ven ningún cambio.

## Detalles técnicos

- Nueva opción por recurrencia: `future_horizon` (por defecto 2) en `recurrence_definitions`, y periodicidad ampliada a 3 / 6 / 12 meses.
- Función `recurrence_fill_horizon(_subscription_id)` que cuenta ocurrencias con `due_date > current_date` y genera las faltantes hasta el horizonte, normalizando al día 1 del mes; índice único `(subscription_id, due_date)` evita duplicados.
- Función `close_recurrence_from_deal(_deal_id)`: localiza la ocurrencia por `generated_deal_id`, marca `executed_at`/`price_quoted`, cierra `generated_task_id`, actualiza `last_executed_date` y llama a `recurrence_fill_horizon`. Se dispara con trigger en `deals` al cambiar `is_won`/`is_lost` y se expone como RPC para el Copiloto y WhatsApp.
- `automations-run` deja de crear sólo la ocurrencia inmediata y usa `recurrence_fill_horizon` para todas las suscripciones; las oportunidades y tareas se siguen creando sólo dentro de la ventana de anticipación, las citas más lejanas quedan como agenda.
- Campos personalizados: dos filas en `contact_custom_fields` (tipo select) más backfill de `contacts.custom_fields` desde las suscripciones, y sincronización bidireccional al guardar.
- Frontend: diálogo `ScheduleNextServiceDialog` al ganar; bloque "Servicio recurrente" en `DealDrawer` y en la ficha del contacto con las próximas 2 fechas; invalidación de `monthly-services`, `tasks`, `pipeline` y `contacts`.

## Orden de entrega
1. Campos personalizados de periodicidad y backfill desde las suscripciones.
2. Horizonte de 2 citas futuras (`recurrence_fill_horizon`) y ajuste de `automations-run`.
3. Cierre automático al ganar o perder, con diálogo de confirmación.
4. Puesta al día de los 35 casos y del horizonte de las 282 suscripciones.
5. Copiloto y WhatsApp usando la misma ruta.