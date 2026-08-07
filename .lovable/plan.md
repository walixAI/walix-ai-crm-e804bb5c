# Agendar el siguiente mantenimiento cuando el deal se gana

## Cómo funciona hoy (verificado)

El motor de **Recurrencias** crea el trabajo, pero **no cierra el ciclo**:

- **Sí hace:** cada mes detecta que un cliente tiene un mantenimiento/cambio de filtro próximo, crea la oportunidad en *Servicio y Mantenimiento* (etapa Solicitud) y genera la tarea de seguimiento.
- **No hace:** no se entera cuando esa oportunidad se gana en el Pipeline.

Por eso hay **35 ocurrencias con la oportunidad ya en Ganado pero la recurrencia sigue en "pendiente"**. Esos 35 clientes no tienen programado su siguiente ciclo.

Respuesta corta a tu pregunta: hoy el vendedor **no tiene** forma desde el Pipeline; tendría que ir a Automatizaciones → Servicios del mes y marcar "Ejecutado".

## Lo que se va a construir

### 1. Ganar la oportunidad cierra el ciclo automáticamente
Al pasar una oportunidad de servicio recurrente a **Ganado** (Kanban, detalle de la oportunidad o Copiloto), el sistema:
- marca la ocurrencia del mes como **Ejecutada** (con fecha y monto cobrado),
- cierra la tarea de seguimiento,
- **programa el siguiente ciclo** (+6 o +12 meses según el servicio) al día 1 del mes correspondiente, creando su tarea de aviso.

Al ganar aparece una confirmación: "Siguiente mantenimiento programado para **febrero 2027**", con opción de **cambiar el mes** si el cliente pidió otra fecha, o de **no programar** si ya no continúa.

### 2. Perdido = no continúa
Si la oportunidad se marca **Perdida**, la ocurrencia queda como "No procede" con el motivo, y se pregunta si se mantiene la suscripción para el siguiente ciclo o se da de baja.

### 3. Visible desde donde trabaja el vendedor
En el detalle de la oportunidad de servicio se muestra un bloque **Servicio recurrente**: tipo de servicio, mes al que corresponde, siguiente ciclo previsto y un botón **Programar siguiente servicio**.

### 4. Puesta al día de los 35 casos
Se regularizan las 35 oportunidades ya ganadas: ocurrencia a Ejecutada con la fecha de cierre real y siguiente ciclo programado desde ese mes, sin duplicar oportunidades ya existentes.

## Detalles técnicos

- Función `close_recurrence_from_deal(_deal_id)` que localiza `recurrence_occurrences.generated_deal_id`, aplica el estado y avanza `recurrence_subscriptions.next_due_date`, centralizando la lógica que hoy vive en `useServiceTransition` para que aplique venga de donde venga el cierre (UI, Copiloto o WhatsApp).
- Se dispara desde un trigger en `deals` al cambiar `is_won` o al llegar a una etapa de tipo ganado, y se expone como RPC segura para el Copiloto.
- `recurrence_occurrences`: se rellenan `executed_at`, `price_quoted` (monto del deal) y `notes`.
- Frontend: diálogo de confirmación al ganar (`ScheduleNextServiceDialog`) con selector de mes; bloque "Servicio recurrente" en `DealDrawer`; invalidación de `monthly-services`, `tasks` y `pipeline`.
- Copiloto: `complete_service` usa la misma función, de modo que cerrar por WhatsApp también programa el siguiente ciclo.
- Backfill puntual de las 35 ocurrencias más la creación de sus tareas de aviso.

## Orden de entrega
1. Función/trigger de cierre y avance de ciclo.
2. Diálogo de confirmación al ganar y bloque en el detalle de la oportunidad.
3. Backfill de los 35 casos.
4. Copiloto/WhatsApp usando la misma ruta.