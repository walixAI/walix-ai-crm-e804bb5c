# Flujo de mantenimientos recurrentes — respuesta informativa

## Alcance
Responder las preguntas del usuario sin modificar código en esta iteración:
1. ¿Cómo se da de alta un mantenimiento anual o semestral?
2. ¿Cómo se ven los mantenimientos programados para este mes o el futuro?

## Estado actual verificado

### 1. Configuración previa: marcar la categoría como recurrente
- Ruta: **Configuración > Organización > Categorías / productos** (`ProductCategoriesCard.tsx`).
- El tenant debe tener una categoría, p. ej. "Mantenimientos".
- Activar el switch **"Recurrente"** y elegir la periodicidad por defecto: Mensual / Trimestral / Semestral / Anual.
- Esto guarda `product_categories.is_recurring = true` y `product_categories.default_period_months`.

### 2. Alta de un mantenimiento (desde Pipeline)
- Ir a **Pipeline > Nueva oportunidad** (`NewDealDialog.tsx`).
- Campos obligatorios: nombre, monto, pipeline/etapa, contacto vinculado.
- En **Categoría / producto** seleccionar "Mantenimientos".
- Guardar. Esto dispara el trigger `deals_ensure_subscription` que ejecuta `ensure_recurrence_subscription(_deal_id)`.
- El trigger:
  - Verifica que la categoría sea recurrente.
  - Busca una `recurrence_definition` activa del tenant con la misma categoría y periodicidad.
  - Si no existe suscripción previa para ese contacto+categoría, crea un `recurrence_subscriptions` con estado `active`.
- La **frecuencia del servicio** (semestral/anual) se puede ajustar después abriendo el deal en el drawer (`DealDrawer.tsx` > campo "Frecuencia del servicio"). Al cambiarla se vuelve a ejecutar el trigger y se reubica la suscripción a la recurrencia correcta.

### 3. Cierre del ciclo: ganar o perder
- Cuando el deal se marca **Ganado** o **Perdido**, el trigger `deals_close_recurrence` ejecuta `close_recurrence_from_deal(_deal_id)`.
- Si es ganado: marca la ocurrencia como `executed` y genera los siguientes ciclos futuros.
- Si es perdido: marca la ocurrencia como `lost`, pero la suscripción sigue activa y sigue generando futuras ocurrencias hasta que se cancele manualmente.
- La continuidad se controla con `recurrence_fill_horizon(subscription_id)`, que mantiene siempre 2 citas futuras por suscripción activa.

### 4. Dónde ver los mantenimientos programados
- **Automatizaciones > Agenda del mes** (`/automations?tab=agenda`): muestra las `recurrence_occurrences` del mes seleccionado. Permite navegar meses, filtrar por estado (Por contactar, Precio aceptado, Agendado, Ejecutado, No cerrado) y exportar CSV.
- **Ficha del contacto**: si el contacto tiene suscripciones, aparece la tarjeta "Suscripciones de servicio" con la periodicidad, próximas citas y botón para dar de baja/reactivar.
- **Mi Día**: ya existe el widget "Recurrencias programadas en el mes" (`MonthRecurrencesCard.tsx`).

## Nota
No se requieren cambios de código en esta iteración. Si más adelante se decide simplificar el flujo (p. ej. agregar frecuencia en el diálogo de nueva oportunidad o crear un wizard directo en la agenda), se puede convertir este documento en plan de implementación.
