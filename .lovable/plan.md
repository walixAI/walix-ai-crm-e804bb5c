# Importador universal + Servicios recurrentes (mantenimientos y filtros)

## Cómo adjuntar el archivo
Sube el Excel directamente en el chat (botón de adjuntar, hasta 20 MB). Con el archivo mapeo las columnas reales de cada hoja antes de escribir el importador. Mientras no esté, el plan queda definido a nivel de estructura.

## Decisión: Automatizaciones, no Agentes IA

Los recordatorios de mantenimiento y de cambio de filtro son fechas conocidas con anticipación. No requieren criterio: requieren puntualidad. Por eso van como **Automatizaciones** (reglas fijas, sin costo por uso, auditables y predecibles).

La IA entra sólo como apoyo opcional encima de la regla: redactar el mensaje de WhatsApp para agendar y priorizar la lista del día. Nunca decide si recordar o no.

## Parte 1 — Importador (para cualquier tenant)

Nueva sección **Importar datos** en Configuración, con cuatro tipos independientes: Productos, Contactos, Oportunidades y Actividades. El tenant sube uno, varios o todos.

Flujo por archivo (Excel o CSV):
1. Subir archivo y elegir la hoja.
2. Mapeo de columnas con sugerencia automática por nombre de encabezado.
3. Vista previa con validaciones: teléfonos normalizados a formato mexicano, fechas, montos, filas con error señaladas.
4. Detección de duplicados (teléfono o correo para contactos) con opción de omitir o actualizar.
5. Confirmación e importación por lotes, con reporte final y posibilidad de deshacer el lote completo.

Cada importación queda registrada (quién, cuándo, cuántas filas, cuántos errores) y todo lo importado se marca con el lote de origen para poder revertirlo.

## Parte 2 — Servicios recurrentes (mantenimientos y filtros)

Funcionalidad nueva y reutilizable por cualquier tenant, que resuelve el caso de Refrigeración:

- **Plan de servicio por cliente/equipo**: tipo (mantenimiento o cambio de filtro), periodicidad (6 meses por defecto), última ejecución y próxima fecha programada.
- **Calendario de filtros 2026–2029**: se carga desde la hoja "Filtros" como fechas programadas del plan, no como periodicidad calculada.
- **Sustitución**: si un cambio de filtro cae cerca de un mantenimiento programado, el sistema marca que uno sustituye al otro y deja una sola visita.

Ciclo de vida de cada servicio, como oportunidad en un pipeline dedicado:
```text
Por contactar -> Fecha propuesta -> Cotizado -> Aceptado -> Agendado -> Ejecutado
```
- **Aviso anticipado**: X días antes (configurable por tenant, por defecto 15) se crea tarea y notificación para contactar al cliente.
- **Retrasos**: el usuario reagenda desde el mismo seguimiento; la fecha se actualiza y queda el registro de por qué se movió.
- **Al ejecutar**: el sistema propone la siguiente fecha (a 6 meses) sólo si no existe ya una futura, y el usuario confirma o cambia el día.

## Parte 3 — Automatizaciones que lo mueven

Plantillas nuevas listas para activar:
- Mantenimiento próximo → tarea + aviso al responsable.
- Cambio de filtro próximo → tarea + aviso, con nota si sustituye un mantenimiento.
- Servicio propuesto sin respuesta X días → recordatorio.
- Cotización enviada sin aceptar X días → aviso al vendedor.
- Servicio ejecutado sin siguiente fecha → tarea para programarlo.

Estas plantillas necesitan el motor de ejecución de automatizaciones, que hoy no existe: se construye la edge function que evalúa por cron los disparadores de fecha, ejecuta las acciones y registra cada corrida en el historial.

## Detalles técnicos

- Tablas nuevas: `import_batches` y `import_rows` (trazabilidad y deshacer), `service_plans` (plan recurrente por contacto/equipo) y `service_events` (cada visita programada, con enlace al deal y al plan). Todas con RLS por `get_user_tenant(auth.uid())` y GRANTs.
- Parseo de Excel/CSV en el navegador con SheetJS; la inserción va por lotes a la base con validación también del lado servidor.
- Pipeline "Servicios" sembrado con las etapas del ciclo, más tipificaciones de seguimiento propias (reagendó, no contesta, aceptó cotización).
- Edge function `automations-run` con modo cron (disparadores por fecha) y modo evento; los avisos usan el sistema de notificaciones y tareas existente.
- La hoja "Pendiente Refacciones" se importa como oportunidades del pipeline de refacciones con su estado (ganada/perdida/activa); "Actividades Diarias" como historial de actividades ligado a cada contacto.

## Orden de entrega
1. Importador (contactos, productos, oportunidades, actividades) — desbloquea la carga de datos.
2. Planes de servicio y pipeline de servicios, con la carga de mantenimientos y filtros.
3. Motor de automatizaciones y plantillas de recordatorio.