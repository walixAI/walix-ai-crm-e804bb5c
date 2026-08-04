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

## Parte 2 — Constructor de recurrencias (lo crea y configura cada tenant)

No se programa un módulo de "mantenimientos". Se construye un **constructor genérico de compromisos recurrentes** dentro de Automatizaciones, con el que cualquier tenant arma sus propios ciclos sin ayuda de nadie.

El tenant crea una **recurrencia** contestando un formulario corto:
1. **¿Cómo se llama?** — ej. "Mantenimiento semestral", "Cambio de filtro", "Renovación de póliza".
2. **¿A quién aplica?** — contactos con cierta etiqueta, cierto producto comprado, o los que el tenant marque uno por uno.
3. **¿Cada cuánto?** — cada N meses/semanas, o **fechas fijas de calendario** cargadas por importación (ese es el caso de los filtros 2026-2029).
4. **¿Con cuánta anticipación avisar?** — N días antes.
5. **¿Qué pasa cuando toca?** — crear tarea, crear oportunidad en el pipeline que el tenant elija, notificar al responsable, o combinación.
6. **¿Y al terminarla?** — el sistema propone la siguiente fecha sólo si no hay otra futura, y el usuario confirma o la cambia.
7. **¿Una recurrencia puede sustituir a otra?** — regla opcional: si dos caen dentro de X días, se conserva una sola visita.

Cada tenant define sus propias etapas del ciclo usando los pipelines que ya existen; no se impone ninguna. Todo lo anterior vive en tablas de configuración por tenant, no en código.

## Parte 3 — Configuración inicial de Refrigeración (datos, no código)

Con el constructor listo, el tenant de Refrigeración queda armado sólo con configuración e importación:
- Recurrencia "Mantenimiento semestral" cada 6 meses, aviso 15 días antes, crea oportunidad en el pipeline de mantenimiento.
- Recurrencia "Cambio de filtro" con fechas fijas importadas de la hoja Filtros (2026-2029), aviso 15 días antes, con la regla de sustitución activada frente al mantenimiento.
- Hoja "Pendiente Refacciones" importada como oportunidades del pipeline de refacciones con su estado.
- Hoja "Actividades Diarias" importada como historial de actividades por contacto.

Si mañana otro tenant vende pólizas anuales o revisiones trimestrales, usa el mismo constructor sin tocar código.

## Parte 4 — Motor de automatizaciones

Hoy la pantalla de Automatizaciones existe pero nada las ejecuta. Se construye el motor: una función que corre por cron, evalúa las recurrencias y disparadores por fecha, ejecuta las acciones configuradas y deja registro de cada corrida (qué se disparó, sobre qué registro, con qué resultado).

La IA es opcional y va encima: redactar el mensaje de WhatsApp para agendar y ordenar la lista del día por prioridad. Nunca decide si recordar o no.

## Detalles técnicos

- Tablas nuevas: `import_batches` e `import_rows` (trazabilidad y deshacer); `recurrence_definitions` (la recurrencia que configura el tenant: audiencia, periodicidad o calendario fijo, anticipación, acciones, regla de sustitución), `recurrence_subscriptions` (a qué contacto/equipo aplica y su próxima fecha) y `recurrence_occurrences` (cada ocurrencia programada, con enlace a la tarea u oportunidad generada y su estado). Todas con RLS por `get_user_tenant(auth.uid())` y GRANTs.
- Nada del comportamiento de Refrigeración queda en código: es contenido de esas tablas más el importador.
- Parseo de Excel/CSV en el navegador con SheetJS; la inserción va por lotes a la base con validación también del lado servidor.
- Edge function `automations-run` con modo cron (disparadores por fecha y recurrencias) y modo evento; los avisos usan el sistema de notificaciones y tareas existente.
- El asistente de creación de recurrencias vive en Automatizaciones, con lenguaje simple y pasos numerados, igual que el diálogo de seguimiento.

## Orden de entrega
1. Importador (contactos, productos, oportunidades, actividades) — desbloquea la carga de datos.
2. Constructor de recurrencias configurable por cualquier tenant.
3. Motor de automatizaciones que ejecuta recurrencias y recordatorios.
4. Configuración de Refrigeración usando el constructor y el importador.