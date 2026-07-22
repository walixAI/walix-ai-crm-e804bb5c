
## Objetivo

Que el gestor (usuario en modo simple) opere todo el día desde **Mi Día → Contacto → Cerrar pendiente** sin perderse, con un perfil de contacto rediseñado en versión "Modo Fácil" cuando `ui_prefs.mode = 'simple'`.

## 1. Login → Mi Día directo

`src/pages/app/RootRedirect.tsx` ya envía a `/mi-dia` cuando `ui_prefs.mode = 'simple'`. Confirmado en lectura.

Ajuste: que `/login` al autenticar también respete el modo (hoy suele mandar a `/dashboard`). Redirigir siempre a `/` y dejar que `RootRedirect` decida. Un solo cambio pequeño en `Login.tsx`.

## 2. Click en pendiente de Mi Día → Perfil del contacto

Hoy las tarjetas de Mi Día abren diálogos o el deal. Cambiar el comportamiento en modo simple:

- **Cobros / Cotizar / Servicios / Seguimiento**: click → `/contacts/{contactId}?focus=task&taskId=…` (si viene de una tarea) o `?focus=deal&dealId=…`.
- **Mis tareas**: click en la tarjeta → `/contacts/{contactId}?focus=task&taskId={id}`.

El query param `focus` lo lee el nuevo perfil "Modo Fácil" para resaltar/abrir el pendiente correspondiente.

## 3. Perfil de contacto — "Modo Fácil"

Nueva vista `src/pages/app/ContactDetailSimple.tsx` (se usa cuando `ui_prefs.mode = 'simple'`; el perfil actual queda intacto para modo estándar). Layout de una sola columna, tipografía grande, foco en acciones:

```text
┌─────────────────────────────────────────────┐
│  ← Mi Día                                   │
│                                             │
│  [Avatar]  Nombre grande                    │
│            Empresa · Teléfono               │
│  [ WhatsApp ]  [ Llamar ]  [ Registrar ]    │
├─────────────────────────────────────────────┤
│  📋 QUÉ TIENES QUE HACER HOY  ← centro      │
│  ┌───────────────────────────────────────┐  │
│  │ ☐ Cobrar $18,500 · vence hoy          │  │
│  │   [Marcar como pagado] [Reagendar]    │  │
│  │ ☐ Enviar cotización refri Sub-Zero    │  │
│  │   [Marcar hecha] [Reagendar]          │  │
│  │ ☐ Llamar para confirmar visita        │  │
│  │   [Registrar llamada] [Reagendar]     │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  💬 Últimos mensajes (3)                    │
│  📝 Últimas notas (2)                       │
└─────────────────────────────────────────────┘
```

Componentes nuevos:
- `src/components/contacts/simple/SimpleContactHeader.tsx` — avatar XL, botones jumbo WhatsApp / Llamar / Registrar actividad.
- `src/components/contacts/simple/PendingList.tsx` — lista central de tareas + acciones rápidas de cierre.
- `src/components/contacts/simple/CloseTaskDialog.tsx` — al pulsar "Marcar hecha" abre modal con 3 opciones: **Enviar WhatsApp** (abre `/whatsapp?contactId=…` y al volver marca hecha), **Registrar llamada** (nota + duración + resultado), **Solo marcar hecha** (nota opcional). Al confirmar: `toggleTask(completed=true)` + `createActivity({type: 'call'|'note'|'whatsapp'})`.
- `src/components/contacts/simple/QuickTourPopover.tsx` — guía de 3 pasos (Header → Pendientes → Actividades) que se muestra la primera vez usando `localStorage` (`walix.simple.tour.contact.v1`). Botón "Ver de nuevo" en el header.

Ruteo: en `src/pages/app/ContactDetail.tsx` detectar `profile.ui_prefs.mode === 'simple'` y renderizar `ContactDetailSimple` en su lugar (o hacerlo en `App.tsx`).

## 4. Cerrar pendiente con evidencia

Flujo canónico (usado por `CloseTaskDialog`):

1. Usuario pulsa botón principal de una tarea.
2. Modal pregunta **¿Cómo la resolviste?** → WhatsApp / Llamada / Otro.
3. Si es WhatsApp: navega a `/whatsapp?contactId=…&pendingTaskId=…`; al enviar el mensaje, marcar tarea como hecha y crear `activity` tipo `whatsapp`.
4. Si es Llamada: campos "Resultado" (contestó / no contestó / dejó mensaje) + nota → `activity` tipo `call` + `toggle task`.
5. Si es Otro: nota libre + `toggle task`.

Reutiliza hooks existentes (`useToggleContactTask`, `useCreateContactActivity`), no toca esquema.

## 5. Fuera de alcance

- No se toca el perfil de contacto del modo estándar.
- No se cambia lógica de pipeline, IA, ni edge functions.
- No se agregan columnas nuevas a la BD.

## Archivos a tocar

- `src/pages/Login.tsx` — redirigir a `/` post-login.
- `src/pages/app/ContactDetail.tsx` — router condicional simple vs estándar.
- `src/pages/app/MiDia.tsx` + tarjetas — navegar a `/contacts/{id}?focus=task&taskId=…`.
- **Nuevos**: `src/pages/app/ContactDetailSimple.tsx`, `src/components/contacts/simple/*` (4 archivos listados arriba).

## Preguntas antes de implementar

1. ¿El botón "Registrar llamada" debe pedir duración o basta con resultado + nota?
2. Cuando el gestor cierra un cobro, ¿marcar también `deals.payment_status = 'pagado'` o solo la tarea?
