# Reparar horizonte de recurrencias (Refrigeración G&R)

## Contexto
El flujo automático funciona así: al ganar una oportunidad de servicio recurrente, `close_recurrence_from_deal` marca la ocurrencia como ejecutada y `recurrence_fill_horizon` agenda las 2 siguientes citas. El job `automations-run` (cada hora) mantiene ese horizonte y, 5 días antes de cada mes de servicio, crea oportunidad + tarea + notificación.

**Problema detectado:** 114 de 325 suscripciones activas del tenant Refrigeración González y Rodríguez no tienen ninguna ocurrencia futura (deberían tener 2). Sin ocurrencias, no se crearán tareas ni oportunidades para esos clientes.

## Pasos

1. **Diagnóstico del job** (solo lectura)
   - Revisar logs de `automations-run` (edge function) para ver si la ejecución horaria falla o se corta antes de la sección 1b (horizonte). Revisar `cron.job_run_details` con paginación acotada.
   - Causa probable: la sección 1 procesa cientos de ocurrencias pendientes secuencialmente y la función excede el tiempo límite antes de llegar a 1b; o un error no capturado aborta el run.

2. **Backfill inmediato de las 114 suscripciones**
   - Ejecutar `SELECT public.recurrence_fill_horizon(id)` para cada suscripción activa del tenant sin ocurrencias futuras. Es idempotente (`ON CONFLICT DO NOTHING`), seguro de correr.

3. **Robustecer `automations-run`**
   - Mover la sección 1b (horizonte) **antes** de la sección 1 (materialización), o envolver cada sección en su propio try/catch para que un fallo en una no impida las demás.
   - Limitar el lote de ocurrencias por ejecución (ej. 200 más urgentes) para evitar timeout.
   - El RPC `recurrence_fill_horizon` por suscripción ya está envuelto en try/catch global; agregar try/catch por suscripción para que una que falle no detenga las demás.

4. **Verificación**
   - Re-correr la consulta de auditoría: suscripciones activas sin citas futuras debe bajar a ~0.
   - Confirmar en logs que el job horario completa la sección de horizonte.

## Notas técnicas
- Funciones involucradas: `recurrence_fill_horizon` (crea hasta `future_horizon`=2 ocurrencias futuras, idempotente), `close_recurrence_from_deal`, edge function `supabase/functions/automations-run/index.ts`.
- No se toca el flujo de usuario ni la UI; Norma y el equipo no cambian nada de cómo operan.
- El backfill es una operación de datos puntual (no migración de esquema); se ejecuta vía SQL directo.
