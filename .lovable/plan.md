# Plan UX: Automatizaciones sin WhatsApp para Refrigeración G&R

## Objetivo

Habilitar las 4 automatizaciones deterministas de la Fase 1 para el tenant Refrigeración González y Rodríguez sin conectar WhatsApp, de modo que los usuarios no vean nuevos elementos en Dashboard, Mi Día, Pipeline, Contactos ni Deals. Todo lo nuevo queda contenido dentro de la pantalla de **Automatizaciones**; los resultados se entregan por los canales que ya usan (tareas, notificaciones, correo y movimientos de etapa).

## Principio de diseño: invisible en pantallas conocidas

- No se agregan badges, banners, tarjetas, columnas, chips ni botones nuevos en Dashboard, Mi Día, Pipeline, Contactos ni Deals.
- Los usuarios perciben la automatización solo por sus efectos: una tarea nueva, una notificación en la campana, un email o un deal que cambió de etapa. Estos efectos usan los componentes y patrones existentes.
- La única pantalla que cambia es **Automatizaciones**, donde ya existe la galería de plantillas y el builder.

## Dónde se configura todo

- **Configuración:** pantalla existente `/app/automations`.
- **Entrada:** botón existente "Nueva automatización" → galería de plantillas.
- **Nuevo contenido permitido:** una sección de plantillas llamada **"Funcionan sin WhatsApp"** dentro de la galería, con las 4 plantillas de la Fase 1 pre-llenadas para el tenant Refrigeración G&R.
- **No se modifica:** el layout, tabs, cards ni acciones de la pantalla de Automatizaciones; solo se agregan plantillas al catálogo.

## Plantillas para Refrigeración G&R (sin WhatsApp)

1. **Recordatorio de mantenimiento próximo**
   - Trigger: `recurrence_due` (15 días antes de cada recurrencia).
   - Acción: `create_task` asignada al vendedor del contacto con título "Contactar a cliente - mantenimiento programado".

2. **Seguimiento de deal estancado**
   - Trigger: `deal_inactive` (5 días sin actividad).
   - Acción: `create_task` + `notify_owner` (in-app + email).

3. **Generar próxima recurrencia al cobrar**
   - Trigger: `deal_won` sobre deals categorizados como "Cambio de filtro" o "Mantenimientos".
   - Acción: `schedule_next_recurrence`.

4. **Reactivación de cliente frío**
   - Trigger: `contact_no_reply` (14 días sin respuesta).
   - Acción: `create_task` "Llamar de nuevo a cliente frío" + opcional `notify_owner`.

## Cómo se entregan los resultados sin WhatsApp

| Resultado | Canal existente | Dónde lo ve el usuario |
|---|---|---|
| Tarea nueva | Tareas del CRM | Mi Día, pestaña Tareas del contacto, lista de tareas |
| Notificación al vendedor | Campana de notificaciones + email | Campana existente, bandeja de correo |
| Deal a etapa siguiente | Pipeline | Kanban existente |
| Próxima recurrencia creada | Servicios recurrentes | Automatizaciones → Agenda del mes / Servicios recurrentes |
| Log de ejecución | Historial de cada automatización | Automatizaciones → card de automatización → historial |

## Flujo de activación sin sorpresas

1. **Vista previa (dry-run):** al crear una automatización desde plantilla, el primer paso es "Probar ahora" en modo simulación. Muestra cuántas tareas/notificaciones se generarían hoy, sin escribir datos.
2. **Activación controlada:** el usuario activa la automatización con un toggle. El builder muestra un resumen de impacto: "Creará aproximadamente N tareas por semana".
3. **Historial visible:** cada automatización tiene un botón de historial existente; el usuario puede ver exactamente qué hizo y desactivarla si genera ruido.

## Cambios técnicos esperados

- Agregar 4 plantillas al archivo `src/lib/automations/templates.ts` marcadas como `requiresWhatsapp: false`.
- En `AutomationTemplateGallery.tsx`, renderizar primero una sección **"Funcionan sin WhatsApp"** para tenants que no tienen canal de WhatsApp conectado.
- Asegurar que las acciones `notify_owner` (in-app + email) y `create_task` funcionen sin depender de WhatsApp en el edge function de ejecución.
- Agregar un campo `dry_run` en el builder/simulación para que el usuario vea el impacto antes de activar.

## Qué NO se hará

- No se agregarán widgets, banners, chips ni toasts nuevos en Dashboard, Mi Día, Pipeline, Contactos ni Deals.
- No se forzará al usuario a conectar WhatsApp para usar estas plantillas.
- No se enviarán mensajes de WhatsApp por ninguna vía.

## Métrica de éxito

- Después de activar, el vendedor debería encontrar solo tareas y notificaciones nuevas en los lugares donde ya está acostumbrado a buscarlas, sin notar que "apareció algo nuevo" en la interfaz.
