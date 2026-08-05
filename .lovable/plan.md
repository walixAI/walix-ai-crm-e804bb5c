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

### 1. Aviso anticipado (el motor respeta los 15 días)
El motor generará la oportunidad y la tarea **15 días antes** (o los días que configure el tenant), no el día del servicio. La oportunidad nace en **Solicitud** con la fecha programada del servicio visible, y notifica al responsable del contacto.

Se añade protección contra duplicados: si ya existe una ocurrencia abierta para ese cliente y servicio, no se vuelve a crear.

### 2. Vista "Mantenimientos del mes"
Nueva pestaña **Servicios del mes** (en Mi Día y en Automatizaciones → Servicios recurrentes) con:
- Selector de mes (agosto 2026, septiembre 2026, ...).
- Lista de clientes que tocan ese mes: nombre, teléfono, servicio, fecha programada, responsable y estado del ciclo (Por contactar / Precio aceptado / Agendado / Ejecutado / Pospuesto / No procede).
- Filtros por responsable, tipo de servicio y estado; contador arriba ("38 servicios este mes: 12 por contactar, 9 agendados, 17 ejecutados").
- Acciones rápidas por fila: WhatsApp al cliente, registrar respuesta, agendar día y hora, marcar ejecutado.

### 3. Ciclo operativo de cada servicio
Cada ocurrencia avanza por estados claros, sincronizados con la oportunidad del pipeline:

```text
Por contactar  →  Precio aceptado  →  Agendado (día y hora)  →  Ejecutado  →  Cobrado
        ↘ Pospuesto (nueva fecha)      ↘ No procede (motivo)
```

- **Registrar respuesta**: precio propuesto y aceptado/rechazado, o posponer con nueva fecha.
- **Agendar**: día y hora concretos; genera la tarea al técnico y mueve la oportunidad a *Agendado*.
- **Marcar ejecutado**: cierra la ocurrencia, mueve la oportunidad a *Completado* y **recién ahí** programa el siguiente ciclo a partir de la fecha real de ejecución (no de la fecha teórica).

### 4. Recordatorios automáticos
- Aviso al responsable cuando entra un servicio nuevo a su lista.
- Resumen el día 1 de cada mes: "Tienes 38 servicios programados este mes".
- Alerta si un servicio del mes llega a 5 días de su fecha sin estar agendado.

### 5. Copiloto
Preguntas como "¿qué mantenimientos tengo este mes?" o "¿quién falta por agendar?" responderán con la lista y el estado, y podrá marcar agendado o ejecutado por WhatsApp.

## Detalles técnicos

- `recurrence_occurrences`: se amplía con `status` extendido (pending, price_accepted, scheduled, executed, postponed, skipped), `scheduled_at`, `price_quoted`, `price_accepted_at`, `executed_at`, `notes`, `assigned_to`; índice por `(tenant_id, due_date, status)` y unicidad por `(subscription_id, due_date)` para evitar duplicados. RLS por `get_user_tenant(auth.uid())` + GRANTs.
- `automations-run/index.ts`: disparar cuando `next_due_date <= today + anticipation_days`; crear la oportunidad en la etapa inicial del pipeline objetivo con `expected_close_date` = fecha del servicio; dejar de avanzar `next_due_date` en el disparo y hacerlo al marcar ejecutado (con respaldo: si pasa el ciclo sin cierre, se marca vencida y avanza).
- Nuevo hook `useMonthlyServices(month)` sobre `recurrence_occurrences` con join a contacto, servicio y deal; mutaciones para cada transición de estado.
- Componentes nuevos bajo `src/components/automations/recurrence/`: `MonthlyServicesView`, `ServiceRowActions`, `ScheduleServiceDialog`, `RegisterPriceDialog`; se reutiliza `DueBadge` para la urgencia.
- Copiloto: extender `get_scheduled_services` con estado y agregar herramientas `schedule_service` y `complete_service` en `whatsapp-ai-command` y `ai-copilot`.
- Backfill: crear las ocurrencias de los servicios que vencen dentro de la ventana de anticipación (septiembre 2026 en adelante) y reconciliar las 42 ocurrencias existentes con sus oportunidades.

## Orden de entrega
1. Estructura de datos y motor con anticipación (sin duplicados).
2. Vista "Servicios del mes" con estados y acciones.
3. Recordatorios y resumen mensual.
4. Copiloto y backfill.
