# Mantenimientos: de "fecha guardada" a agenda del mes que se ejecuta

## Cómo funciona hoy (verificado en la base)

Hay 4 servicios recurrentes activos con 282 clientes suscritos:

| Servicio | Cada | Aviso | Clientes |
|---|---|---|---|
| Mantenimiento semestral | 6 meses | 15 días antes | 130 |
| Cambio de filtro semestral | 6 meses | 15 días antes | 25 |
| Mantenimiento anual | 12 meses | 15 días antes | 43 |
| Cambio de filtro anual | 12 meses | 15 días antes | 84 |

Cada cliente tiene una "próxima fecha". Un proceso corre cada hora y, **el mismo día en que vence**, crea la oportunidad en el pipeline *Servicio y Mantenimiento* (etapa Agendado), crea una tarea de seguimiento y recorre la fecha al siguiente ciclo.

Problemas confirmados:
1. **El aviso de 15 días no se usa.** El campo existe pero el motor sólo dispara el día exacto del vencimiento: el gestor se entera el mismo día, sin tiempo para contactar, cotizar y agendar.
2. **No existe la vista "mantenimientos de este mes".** Nada en Mi Día, Dashboard ni un calendario muestra quiénes tocan en agosto/septiembre. Hoy sólo se ve entrando contacto por contacto.
3. **El ciclo no se cierra.** Las 42 ocurrencias generadas siguen todas en "pendiente"; nadie registra si se aceptó el precio, qué día se agendó, ni si se ejecutó.
4. **La oportunidad nace en "Agendado"** aunque todavía no se ha hablado con el cliente ni se ha acordado precio ni día.

## Lo que se va a construir

### 1. Todo se ancla al mes del servicio (día 1)
La base importada sólo trae el mes, así que cada servicio se fija al **día 1 de su mes**. Ese es el compromiso visible: "en septiembre 2026 toca el mantenimiento de Tania".

### 2. Oportunidades para todos los ciclos
Verificado en la base: la importación no dejó historial anterior a agosto 2026. Los 42 servicios de **agosto 2026** quedaron marcados como "ejecutados" aunque nadie los ha trabajado, y los siguientes ciclos van de septiembre 2026 a agosto 2027 (33, 32, 36, 31, 43, 28... por mes).

Se generan oportunidades en el pipeline *Servicio y Mantenimiento*:
- **Agosto 2026 (mes en curso, 42 servicios)** → se corrige la marca de "ejecutado" y nacen en **Solicitud**, con fecha 1 ago 2026 y tarea vencida visible, porque siguen pendientes de contactar.
- **Meses futuros (sep-26 en adelante)** → oportunidad en **Solicitud** al día 1 del mes, con su tarea de aviso.
- **Meses pasados** → si en el futuro se cargan ciclos anteriores, se crean directamente en **Completado** como historial.

Sin duplicados: un solo registro por cliente + servicio + mes, aunque el proceso corra muchas veces.

### 3. Tareas y agenda visibles en Mi Día
Cada servicio futuro genera una **tarea de seguimiento** asignada al responsable del contacto, con vencimiento **5 días antes del inicio del mes** (servicio de septiembre → tarea el 27 de agosto). Aparecen en **Mi Día** y en **Tareas**, con cliente, servicio y mes al que corresponden.

### 4. Recordatorio anticipado
- Notificación al responsable 5 días antes de que empiece el mes: "En septiembre tienes 24 servicios programados".
- La tarea se marca vencida y en rojo si el mes arranca sin haber contactado al cliente.

### 5. Vista "Servicios del mes"
Pestaña con selector de mes que lista los clientes de ese mes: cliente, teléfono, servicio, responsable y estado (Por contactar / Precio aceptado / Agendado / Ejecutado / Pospuesto / No procede), con filtros por responsable y tipo, contadores, y acciones rápidas por fila (WhatsApp, registrar precio, agendar día y hora, marcar ejecutado).

### 6. Ciclo operativo
```text
Por contactar → Precio aceptado → Agendado (día y hora) → Ejecutado → Cobrado
        ↘ Pospuesto (otro mes)        ↘ No procede (motivo)
```
Al marcar **Ejecutado** se cierra la oportunidad en *Completado* y se programa el siguiente ciclo (+6 o +12 meses) al día 1 del mes que corresponda.

### 7. Copiloto
"¿Qué mantenimientos tengo este mes?" o "¿quién falta por agendar?" responderán con la lista y su estado, y podrá marcar agendado o ejecutado desde WhatsApp.

## Detalles técnicos

- `recurrence_occurrences`: `due_date` normalizado al día 1 del mes; estados extendidos (pending, price_accepted, scheduled, executed, postponed, skipped, historic); campos `scheduled_at`, `price_quoted`, `price_accepted_at`, `executed_at`, `assigned_to`, `notes`; índice único `(subscription_id, due_date)` e índice `(tenant_id, due_date, status)`. RLS por `get_user_tenant(auth.uid())` + GRANTs.
- `anticipation_days` de las 4 recurrencias se ajusta de 15 a 5 días.
- `automations-run/index.ts`: dispara cuando `next_due_date <= today + anticipation_days`; crea la oportunidad en la etapa inicial del pipeline con `expected_close_date` = día 1 del mes; crea la tarea con `due_at` = inicio del mes menos 5 días; `next_due_date` avanza al marcar Ejecutado (respaldo automático si pasa el ciclo completo sin cierre).
- Backfill de datos: recorrer las 282 suscripciones y su historial de meses; oportunidades de meses pasados en *Completado* con `expected_close_date` al día 1 de ese mes, y de mes actual/futuros en *Solicitud* con su tarea; reconciliar las 42 ocurrencias existentes en vez de duplicarlas.
- Nuevo hook `useMonthlyServices(month)` sobre `recurrence_occurrences` con join a contacto, servicio y deal, más mutaciones por transición de estado.
- Componentes nuevos en `src/components/automations/recurrence/`: `MonthlyServicesView`, `ServiceRowActions`, `ScheduleServiceDialog`, `RegisterPriceDialog`; reutilizando `DueBadge`.
- Mi Día y Tareas: incluir las tareas de servicio recurrente con etiqueta del mes; recordatorio mensual vía el sistema de notificaciones existente.
- Copiloto: extender `get_scheduled_services` con estado y agregar `schedule_service` y `complete_service` en `whatsapp-ai-command` y `ai-copilot`.

## Orden de entrega
1. Estructura de datos y motor anclado al día 1 del mes, con aviso 5 días antes.
2. Backfill: oportunidades pasadas en Completado, futuras en Solicitud, más sus tareas.
3. Vista "Servicios del mes" con estados y acciones.
4. Recordatorios en Mi Día/Tareas y Copiloto.
