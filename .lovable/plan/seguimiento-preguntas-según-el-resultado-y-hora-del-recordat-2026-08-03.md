# Seguimiento: preguntas según el resultado y hora del recordatorio

## Problema

El paso 4 del formulario siempre pregunta **"¿Por qué no avanza?"**, incluso cuando el usuario eligió un resultado que hace avanzar la oportunidad. Además, el recordatorio siempre queda a las 10:00 sin posibilidad de cambiar la hora.

## Cambio 1 — El paso 4 se adapta al resultado

El bloque de diagnóstico cambia de título y de opciones según el comportamiento de la tipificación elegida en el paso 2:

| Resultado elegido | Qué muestra el paso 4 |
|---|---|
| **Avanza** (mueve de etapa) | "4. ¿En qué quedaron?" — confirma que sigue avanzando, con la etapa nueva a la vista. Un enlace discreto "Reportar un problema" revela las opciones de bloqueo o pérdida si el usuario las necesita. |
| **Permanece / Sugiere** | "4. ¿Por qué no avanza?" — las tres opciones actuales (Todo bien / Está esperando algo / Ya no quiere). |
| **Cierre ganado** | El paso 4 no aparece; tampoco el recordatorio. |
| **Cierre perdido** | "4. ¿Por qué se perdió?" — directo al catálogo de motivos, sin las otras opciones. |

Si ya existe un bloqueo vigente, la tarjeta "Ya se resolvió" se sigue mostrando en todos los casos donde aplique, y al elegir un resultado que avanza queda preseleccionada como resuelta.

## Cambio 2 — Hora del recordatorio editable

En el paso 3, debajo de los botones de día, se agrega un selector de hora con opciones grandes y legibles (9:00, 10:00, 12:00, 16:00) más un campo de hora libre para cualquier otro horario. El texto de confirmación refleja la hora elegida: "Te lo recordaremos el martes 5 de agosto a las 16:00".

El valor por defecto sigue siendo 10:00, así que quien no toque nada no ve ningún cambio de comportamiento.

## Detalle técnico

- `src/components/activity/LogFollowUpDialog.tsx` es el único archivo a modificar.
- Nuevo estado `nextTime` (HH:MM) usado por `dayToIso(day, time)` en lugar de la hora fija 10:00.
- El bloque de diagnóstico se decide con `outcome.stageBehavior`, `outcome.isWon` y `outcome.isLost`, que ya existen; se agrega un estado local `showProblem` para el enlace "Reportar un problema" en el caso de avance.
- Al elegir un resultado que avanza, `diagMode` pasa a `"none"` y, si hay bloqueo vigente, `clearBlocker` se activa por defecto.
- Sin cambios en base de datos ni en `useLogFollowUp`.
