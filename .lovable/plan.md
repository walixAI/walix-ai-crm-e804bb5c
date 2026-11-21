# Estados del asesor para recepción de llamadas (tipo Contact Center)

## Qué verá el asesor
- Un selector de estado siempre visible en la barra superior (punto de color + nombre del estado y cronómetro de cuánto lleva en él).
- Estados base:
  - **Disponible** (verde): recibe llamadas en Walix y/o celular.
  - **En llamada** (rojo, automático): se pone solo al contestar y vuelve a Disponible al colgar (con unos segundos opcionales de "Cierre / tipificación").
  - **Pausas** (ámbar): Baño, Comida, Descanso, Coaching, Capacitación, Junta, Trabajo administrativo.
  - **Desconectado** (gris): automático al cerrar sesión o sin actividad.
- En cualquier pausa o desconectado **no le suena ninguna llamada** (ni en Walix ni en celular), pero sigue viendo avisos y no atendidas.
- Aviso suave si una pausa excede su tiempo máximo (ej. Comida 60 min, Baño 10 min).

## Qué configura el propietario / administrador
En Configuración → Llamadas → "Estados del asesor":
- Activar/desactivar, renombrar y crear motivos de pausa propios.
- Tiempo máximo por pausa y si cuenta como "productiva" (Coaching) o no.
- Qué pasa con la llamada si el asesor asignado está en pausa: pasar al grupo configurado (todos / supervisores / asesor específico) o dejarla como no atendida para devolución.
- Supervisor puede cambiar el estado de un asesor (ej. sacarlo de pausa olvidada).

## Tablero en vivo (supervisores)
- Nueva pestaña en Llamadas: "Equipo en vivo" con cada asesor, su estado actual y tiempo en él, llamadas atendidas hoy.

## Reporte
- En la pestaña "Por responsable": tiempo disponible, en llamada, en cada pausa, % ocupación y adherencia (pausas excedidas). Incluido en el CSV.

## Detalles técnicos
- Tablas nuevas con RLS por tenant + GRANTs:
  - `agent_status_reasons` (catálogo por tenant: nombre, tipo available/pause/offline, max_minutes, productive, orden, activo). Semilla con los estados base.
  - `agent_status_current` (tenant_id, user_id, reason_id, since, set_by) — una fila por asesor.
  - `agent_status_log` (historial inmutable: inicio, fin, motivo, quién lo cambió) para el reporte.
- RPC autenticado `set_agent_status(reason_id)` valida membresía activa en el tenant; supervisores/admin pueden cambiar a otros. Cierra el tramo previo en el log de forma atómica.
- `telephony-routing.ts`: filtra `notificationUserIds` para `receivingTargets` y `browserRecipients` dejando solo asesores en estado Disponible; si el asesor asignado está en pausa aplica el modo de desborde de `tenant_inbound_call_settings`. La notificación sigue llegando.
- Webhook: al contestar (`inbound-*-accept`, salientes) pone "En llamada"; al terminar regresa al estado previo disponible. Sin heartbeat del navegador por X min → Desconectado (worker programado existente con autenticación de cron).
- Frontend: `AgentStatusSelector` en TopBar, realtime para el tablero, hook `useAgentStatus`; `useIncomingBrowserCall` no registra recepción cuando no está Disponible.
- Pruebas: enrutamiento omite asesores en pausa, desborde al grupo, cálculo de tiempos por estado en el reporte.

## Fuera de alcance (por ahora)
- Cola de espera con música y distribución por turno (ACD); se puede agregar después sobre estos estados.
