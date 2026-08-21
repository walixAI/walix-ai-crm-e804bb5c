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

Dos canales, ambos ya existentes en Walix:

### 1. Notificación dentro de Walix (con email opcional)

- La automatización siempre genera una **notificación en la campana** de Walix (tabla `notifications`, componente `NotificationsBell` que ya existe). No aparece nada nuevo en pantalla: solo el contador de la campana sube.
- Cada usuario decide en **Perfil → Notificaciones** si además quiere recibir el mismo aviso por **correo**. Es un switch por categoría (Mantenimientos, Seguimiento, Cobranza), apagado por defecto.
- El correo usa la plantilla transaccional existente de Walix con el nombre del tenant; no se crea un diseño nuevo.

```text
Campana (siempre)            Correo (opt-in por usuario)
┌────────────────────┐       ┌────────────────────────────┐
│ 🔔 3                │  -->  │ Walix · Refrigeración G&R  │
│ Mantenimiento de    │       │ 2 mantenimientos esta      │
│ Janice Jaris en 15d │       │ semana. Ver en Walix →     │
└────────────────────┘       └────────────────────────────┘
```

### 2. Bandeja de propuestas de IA, colapsable, en Mi Día y Tareas

- Las tareas que genera la automatización **no se crean directamente**. Entran como **propuestas** que el usuario acepta o rechaza.
- El bloque **"Propuestas de Walix IA"** es **colapsable**: por defecto llega **colapsado** a una sola línea, y el usuario lo despliega con un clic. El estado (abierto/cerrado) se recuerda por usuario.
- Ubicaciones:
  - En **Mi Día**, como un widget más de la lista de widgets configurables (ocultable desde "Personalizar mi vista").
  - En **Tareas**, como una **pestaña adicional** con contador: `Propuestas (3)`.

Colapsado (estado por defecto):

```text
┌──────────────────────────────────────────────────────┐
│ ✨ Propuestas de Walix IA   ● 3 nuevas      Ver  ▼  │
└──────────────────────────────────────────────────────┘
```

Desplegado:

```text
┌─ ✨ Propuestas de Walix IA ───────────── 3 ─── ▲ ─┐
│ 🔧 Mantenimiento de Janice Jaris                  │
│    Vence en 15 días · Norma Heredia               │
│                              [Aceptar] [Rechazar] │
├───────────────────────────────────────────────────┤
│ ⏱ Oportunidad sin movimiento — Leah               │
│    5 días sin actividad                           │
│                              [Aceptar] [Rechazar] │
└───────────────────────────────────────────────────┘
```

- Al aceptar: la tarea aparece en la lista de tareas normal, con su fecha y responsable. Flujo que ya conoce.
- Al rechazar: desaparece del bloque y la automatización aprende a no repetirla.
- Si no hay propuestas, el bloque no se muestra (cero ruido visual).

### 3. Señales que invitan a desplegar

Cuando se generan propuestas nuevas, el usuario recibe tres avisos de intensidad creciente, todos discretos:

1. **Campana del header (siempre):** el ícono de la campana muestra un punto rojo con el conteo. Al abrirla, la notificación dice "Walix IA tiene 3 propuestas para ti" y al hacer clic lleva a Mi Día con el bloque ya desplegado y resaltado un instante.
2. **Barra colapsada con estado "nuevas":** mientras haya propuestas sin revisar, la barra colapsada muestra un punto pulsante y el texto "3 nuevas". Cuando el usuario la despliega una vez, el punto desaparece y solo queda el contador.
3. **Contador en la navegación:** el ítem **Mi Día** del menú lateral (y **Tareas**) muestra un badge numérico pequeño con las propuestas pendientes, igual que un contador de mensajes sin leer.

```text
Header                       Menú lateral            Mi Día
┌────────────── 🔔③ ─┐       ┌──────────────┐        ┌─────────────────────────┐
│ walix              │       │ Inicio       │        │ ✨ Propuestas  ●3  Ver ▼│
└────────────────────┘       │ Mi Día    ③  │        └─────────────────────────┘
                             │ Tareas    ③  │
                             └──────────────┘
```

- Ninguna señal bloquea, interrumpe ni abre modales. Si el usuario las ignora, nada cambia en su flujo diario.
- El badge se limpia solo cuando el usuario despliega el bloque y revisa las propuestas.


### Resumen por canal

| Resultado | Canal | Dónde lo ve |
|---|---|---|
| Aviso de mantenimiento o deal estancado | Campana + correo opcional | Campana de Walix, bandeja de correo |
| Tarea sugerida | Propuestas de Walix IA | Mi Día (widget) y Tareas (pestaña) |
| Tarea aceptada | Tareas normales | Mi Día, contacto, lista de tareas |
| Próxima recurrencia creada | Servicios recurrentes | Automatizaciones → Agenda del mes |
| Log de ejecución | Historial de la automatización | Automatizaciones → card → historial |

## Flujo de activación sin sorpresas

1. **Vista previa (dry-run):** al crear una automatización desde plantilla, el primer paso es "Probar ahora" en modo simulación. Muestra cuántas propuestas y notificaciones se generarían hoy, sin escribir datos.
2. **Activación controlada:** el usuario activa la automatización con un toggle. El builder muestra un resumen de impacto: "Generará aproximadamente N propuestas por semana".
3. **Historial visible:** cada automatización tiene un botón de historial existente; el usuario puede ver exactamente qué propuso, qué se aceptó y qué se rechazó.


## Cambios técnicos esperados

- Agregar 4 plantillas a `src/lib/automations/templates.ts` marcadas como `requiresWhatsapp: false`.
- En `AutomationTemplateGallery.tsx`, mostrar primero la sección "Funcionan sin WhatsApp" cuando el tenant no tiene canal de WhatsApp conectado.
- Nueva acción de automatización `propose_task`: en vez de insertar en `tasks`, inserta una propuesta pendiente (se reutiliza `ai_proactive_suggestions`, que ya tiene tenant, entidad, prioridad y estado).
- Nuevo componente colapsable `AiProposalsPanel` (basado en Collapsible de shadcn) reutilizado en el widget de Mi Día y en la pestaña "Propuestas" de Tareas. Aceptar crea la tarea real; rechazar marca la sugerencia como descartada.
- Hook `usePendingProposalsCount` que alimenta el badge del menú lateral (`Sidebar` y `BottomNav`) y el estado "nuevas" de la barra colapsada. El estado abierto/cerrado se guarda en preferencias del usuario.
- Registrar el widget `midia.ai_proposals` en el catálogo de widgets para que se pueda ocultar desde "Personalizar mi vista".
- La acción `notify_owner` escribe en `notifications` (campana) con deep link a `/mi-dia?proposals=open` y, si el usuario tiene el switch de correo activo, encola el email con la plantilla transaccional existente.
- Agregar en Perfil → Notificaciones los switches de correo por categoría.

## Qué NO se hará

- No se agregarán banners, modales ni toasts intrusivos en Dashboard, Pipeline, Contactos ni Deals.
- Los únicos elementos nuevos son la barra colapsable "Propuestas de Walix IA" y los badges numéricos en el menú; ambos desaparecen cuando no hay propuestas pendientes.
- No se crearán tareas automáticamente sin aprobación del usuario.
- No se enviarán mensajes de WhatsApp por ninguna vía.


## Métrica de éxito

- El vendedor solo ve un bloque de propuestas cuando la IA tiene algo que sugerir, y todo lo que acepta cae en las listas de tareas que ya usa a diario.

