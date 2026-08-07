# Agendar el siguiente mantenimiento cuando el deal se gana

## Cómo funciona hoy (verificado)

Hay dos caminos para cerrar un mantenimiento y **no están conectados**:

1. **Servicios del mes** (dentro de Automatizaciones): botón "Ejecutado". Este sí cierra el ciclo: marca la ocurrencia como ejecutada, cierra la tarea, mueve la oportunidad a Completado y recorre `next_due_date` +6 o +12 meses.
2. **Pipeline**: el vendedor arrastra la oportunidad a **Ganado**. No existe ningún trigger ni código que avise a la recurrencia: la ocurrencia sigue en "pendiente" y **el siguiente mantenimiento nunca se programa**.

Datos actuales del tenant: **35 ocurrencias con la oportunidad ya ganada pero todavía en estado "pendiente"** (contra 14 correctamente ejecutadas). Esos 35 clientes hoy no tienen su siguiente ciclo agendado.

Respuesta corta a tu pregunta: hoy el vendedor **no tiene** forma desde el Pipeline; tendría que ir a Automatizaciones → Servicios del mes y marcar "Ejecutado", vista pensada más para administración.

## Lo que se va a construir

### 1. Ganar la oportunidad cierra el ciclo automáticamente
Al pasar una oportunidad de servicio recurrente a **Ganado** (por Kanban, por el detalle de la oportunidad o por el Copiloto), el sistema:
- marca la ocurrencia del mes como **Ejecutada** (con fecha y monto cobrado),
- cierra la tarea de seguimiento,
- **programa el siguiente ciclo** (+6 o +12 meses según el servicio) al día 1 del mes correspondiente, creando su tarea de aviso.

Al ganar aparece una confirmación: "Siguiente mantenimiento programado para **febrero 2027**", con opción de **cambiar el mes** si el cliente pidió otra fecha, o de **no programar** (cliente que ya no continúa).

### 2. Perdido = no continúa
Si la oportunidad se marca **Perdida**, la ocurrencia queda como "No procede" con el motivo, y se pregunta si se mantiene la suscripción para el siguiente ciclo o se da de baja.

### 3. Visible desde donde trabaja el vendedor
En el detalle de la oportunidad de servicio se muestra un bloque **Servicio recurrente**: tipo de servicio, mes al que corresponde, siguiente ciclo previsto y un botón **Programar siguiente servicio** para usarlo aunque el deal no se haya ganado aún.

### 4. Puesta al día de los 35 casos
Se regularizan las 35 oportunidades ya ganadas: ocurrencia a Ejecutada con la fecha de cierre real y siguiente ciclo programado desde ese mes, sin duplicar oportunidades ya existentes.

## Detalles técnicos

- Trigger en `deals` (AFTER UPDATE OF `is_won`/etapa cerrada) apoyado en una función `close_recurrence_from_deal(_deal_id)` que localiza `recurrence_occurrences.generated_deal_id`, aplica el estado y avanza `recurrence_subscriptions.next_due_date`, centralizando en la base la lógica que hoy vive en `useServiceTransition` para que aplique venga de donde venga el cierre (UI, Copiloto o WhatsApp).
- `recurrence_occurrences`: se rellenan `executed_at`, `price_quoted` (monto del deal) y `notes`.
- Frontend: diálogo de confirmación al ganar (`ScheduleNextServiceDialog`) con selector de mes; bloque "Servicio recurrente" en `DealDrawer`; invalidación de `monthly-services`, `tasks` y `pipeline`.
- Copiloto: `complete_service` usa la misma función, de modo que cerrar por WhatsApp también programa el siguiente ciclo.
- Backfill puntual de las 35 ocurrencias más la creación de sus tareas de aviso.

## Orden de entrega
1. Función/trigger de cierre y avance de ciclo.
2. Diálogo de confirmación al ganar y bloque en el detalle de la oportunidad.
3. Backfill de los 35 casos.
4. Copiloto/WhatsApp usando la misma ruta.