# Canal «Llamadas» para Walix (inicia con SCALA)

## Objetivo
Agregar la telefonía como un canal más de Walix, al mismo nivel que WhatsApp y Email: el asesor llama con un clic, recibe llamadas de sus leads, hay PBX con menú/horarios/buzón, campañas de marcación automática configurables por tenant, y análisis de IA de cada llamada (transcripción, resumen, perfilamiento y seguimiento automáticos).

## Diseño neutro de proveedor
- Capa de abstracción `telephony-provider` en el backend: una interfaz única (makeCall, answerCall, record, transcribe, webhooks de estado) con adaptadores intercambiables.
- Primer adaptador: **Telnyx** (más barato, troncal propia). Segundo adaptador previsto: Twilio. Cambiar de proveedor = cambiar configuración del canal, sin tocar la app.
- Credenciales por tenant/canal, cifradas como las de email; los asesores nunca ven secretos.

## Base de datos (todo con RLS por tenant)
- `call_channels`: número, proveedor, credenciales cifradas, configuración PBX (menú, horarios, buzón), reglas de remarcado.
- `calls`: dirección (saliente/entrante), contacto, asesor, estado, duración, grabación (URL firmada), transcripción, resumen IA, resultado/tipificación.
- `call_campaigns` + `call_campaign_contacts`: listas de marcación, horarios, reintentos, reglas de «si no contesta» (remarcar N veces cada X horas o agendar).
- Triggers: llamadas se reflejan en `activities` del lead (igual que WhatsApp), y resultados de llamada pueden mover etapas con las reglas ya existentes.

## Backend (edge functions)
- `telephony-api`: iniciar llamada, colgar, consultar estado; autorización por tenant/rol.
- `telephony-webhook`: eventos del proveedor (ringing, contestada, terminada, grabación lista); actualiza `calls` y dispara análisis.
- `call-analyzer`: al llegar la grabación → transcribe (Lovable AI, speech-to-text) → resume → sugiere perfilamiento, resultado y tipificación → el asesor confirma en un clic (nada se guarda sin su visto bueno).
- `call-campaign-worker`: escanea campañas activas, respeta horarios y reglas de remarcado del tenant, marca y conecta con el asesor disponible.

## Frontend
- Botón «Llamar» en: detalle de contacto, detalle de oportunidad, Kanban, Mi Día e Inbox (solo asesores con canal asignado).
- Pantalla `/llamadas`: historial con filtros, reproductor de grabación, transcripción y resumen IA.
- Llamada entrante: aviso emergente con datos del lead (si el número coincide con un contacto asignado) y opción de contestar.
- Configuración → «Llamadas» (solo admin/propietario): canal, PBX (menú, horarios, buzón), reglas de remarcado, campañas.
- Vendedores: solo llaman y ven sus propias llamadas (misma lógica de permisos que leads).

## Análisis de IA
- Transcripción con el modelo de speech-to-text del gateway de IA de Lovable; resumen y extracción con el modelo de chat por defecto.
- Reutiliza la infraestructura existente: perfilamiento autocompletado, tipificaciones sugeridas, avance de etapas y registro en Actividad.

## Fases de entrega
1. **Fase 1 (esta entrega):** estructura de base de datos, capa de proveedor neutra, botón «Llamar», historial de llamadas, webhook de estados, registro en Actividad.
2. **Fase 2:** llamadas entrantes con aviso emergente y PBX (menú, horarios, buzón).
3. **Fase 3:** campañas de marcación automática con reglas de remarcado.
4. **Fase 4:** análisis de IA (transcripción, resumen, perfilamiento, tipificación sugerida).

## Notas
- La cuenta del proveedor (Telnyx/Twilio) se crea a nombre del cliente, igual que con Meta.
- Sin credenciales reales todavía: la Fase 1 queda lista para conectar en cuanto exista la cuenta; mientras tanto se puede probar con un canal simulado (como /wa-sim).
- Grabación de llamadas: se incluirá aviso de grabación configurable por tenant (obligación legal en varios países).
