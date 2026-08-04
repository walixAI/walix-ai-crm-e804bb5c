# Número global de Walix (Copilot por WhatsApp)

Objetivo: dejar operativo **un solo número de WhatsApp de Walix** que los equipos de todos los tenants usan para hablar con el Copilot, administrado únicamente por el dueño de la plataforma.

## Qué se construye

### 1. Canal de plataforma
- Registrar un canal único con `is_platform = true`, `tenant_id = NULL`, `kind = 'team'`, etiqueta "Walix Bot (global)".
- Índice único parcial: solo puede existir un canal de plataforma activo.
- Guardar Phone Number ID, WABA ID, verify token y access token, protegidos por RLS: solo el dueño/staff de plataforma puede leerlos o editarlos.

### 2. Panel de administración (solo Walix)
Nueva pestaña **"WhatsApp Global"** en `/platform`:
- Formulario para capturar Phone Number ID, WABA ID, número visible y token.
- Estado en vivo: último webhook recibido, último mensaje entrante, errores.
- URL del webhook y verify token listos para copiar a Meta.
- Botón "Enviar mensaje de prueba".
- Lista de teléfonos autorizados de todos los tenants (con su empresa y nivel de permiso) y switch para habilitar/deshabilitar.

### 3. Ruteo del webhook para el número global
Hoy el webhook deduce el tenant desde el canal. En el número global el canal no tiene tenant, así que:
- Si el canal que hace match es de plataforma, se resuelve el tenant por el teléfono del remitente en `whatsapp_user_access` (con variantes de formato MX).
- Teléfono no autorizado en ningún tenant → responder "no autorizado" y no crear datos.
- Teléfono autorizado en más de un tenant → responder pidiendo elegir empresa y recordar la elección 24 h.
- Con el tenant resuelto, se invoca `whatsapp-ai-command` igual que hoy y se responde por el número global.

### 4. Costos y créditos
- El consumo del número global se carga al **tenant resuelto**, no a Walix, vía `wa_charge_conversation`.
- Las respuestas del Copilot dentro de la ventana de 24 h siguen sin costo.

### 5. Invitaciones
- `whatsapp-team-invite` usará el número global cuando el tenant no tenga número de equipo propio, para que la invitación llegue desde el mismo número con el que van a conversar.

## Detalles técnicos
- Migración: columnas/índice en `whatsapp_channels`, políticas RLS y GRANTs para el canal de plataforma.
- Edge functions: `whatsapp-webhook` (resolución de tenant por remitente), `whatsapp-send` (envío por canal global cobrando al tenant), `whatsapp-team-invite` (fallback al canal global).
- Frontend: pestaña nueva en `src/pages/app/Platform.tsx` con `PlatformWhatsappTab.tsx` y queries en `src/lib/whatsappChannels.ts`.
- No cambia el comportamiento de los números propios de cada tenant hacia sus clientes.

## Lo que necesito al implementar
Los datos del WABA de Walix: Phone Number ID, WABA ID, número y token permanente. El token se guarda como secreto, nunca en el código.