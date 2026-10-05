# Agente vendedor de WhatsApp: conocimiento, objetivo, perfilado y escalamiento

## Qué vas a poder hacer
En **Configuración → WhatsApp → Agente vendedor**, cada empresa arma su agente en 5 secciones:

1. **Identidad y objetivo**
   - Nombre del agente, tono (formal, cercano), idioma.
   - Objetivo principal: calificar, agendar cita, cotizar, inscribir/vender.
   - Lo que nunca debe hacer (prometer descuentos, dar precios no autorizados, etc.).

2. **Base de conocimiento**
   - Fichas de texto: programas/productos, precios, becas/promociones, requisitos, horarios.
   - Preguntas frecuentes (pregunta + respuesta).
   - Archivos PDF (folletos, temarios, listas de precios): se leen y se guardan como texto.
   - Ligas de la página web: se leen una vez y se pueden actualizar con un botón.
   - Opción de usar los productos que ya están en Walix.

3. **Perfilado del lead**
   - Lista de preguntas clave que el agente debe ir obteniendo en la plática (ej.: programa de interés, modalidad, cuándo quiere empezar, presupuesto, ya terminó la prepa).
   - Cada respuesta se guarda en los campos del contacto.
   - Calificación automática: frío / tibio / caliente y puntuación 0-100.
   - Reglas para mover la Oportunidad de etapa (ej.: "si ya dio todos los datos → Calificado").

4. **Escalamiento al asesor**
   - Cuándo pasa la plática a una persona: lead caliente, pide hablar con alguien, pregunta fuera de la base de conocimiento, queja o molestia, o tras N mensajes sin avance.
   - Al escalar: el agente se calla en ese chat, avisa al asesor (notificación y, si lo tiene, WhatsApp interno) con un resumen y lo ya perfilado, y crea una tarea "Contactar ahora".
   - El asesor siempre puede "Tomar control" o "Devolver al agente".

5. **Modo de trabajo**
   - **Solo sugiere** (por defecto): el agente redacta, el asesor decide si se envía.
   - **Responde solo**: contesta en automático, solo dentro de las 24 h (gratis).
   - **Mixto**: responde solo fuera de horario o si el asesor no contesta en X minutos.
   - Botón "Probar agente": un chat de prueba en la misma pantalla, sin mandar nada a WhatsApp.

## Cómo se ve para el asesor
- En la Bandeja, cada chat muestra "Agente activo", "Escalado a ti" o "Atendido por asesor".
- Panel del lado derecho: lo que el agente ya averiguó del lead, su calificación y por qué escaló.
- El Asistente del Lead usa la misma base de conocimiento para sus mensajes sugeridos.

## Control de gasto
- El agente nunca manda plantillas pagadas por su cuenta; fuera de 24 h se respetan los límites que ya existen.
- Cada respuesta del agente se registra y descuenta créditos de IA con el motor asignado a la empresa, y aparece en "Consumo del mes".
- Tope configurable de respuestas automáticas por lead al día.
- Disponible para todas las empresas; se enciende por empresa (apagado al inicio).

## Fuera de alcance por ahora
- Llamadas de voz, cobros dentro del chat, agenda conectada a Google Calendar.

## Detalles técnicos
- Tablas nuevas con `tenant_id`, RLS `get_user_tenant(auth.uid())` y GRANTs: `wa_agent_config` (identidad, objetivo, modo, reglas de escalamiento y etapa, preguntas de perfilado), `wa_agent_knowledge` (tipo texto/faq/pdf/url, contenido, embedding para búsqueda), `wa_agent_sessions` (estado por conversación: activo/escalado/asesor, datos perfilados, score, motivo).
- PDFs en bucket privado; extracción de texto en una función al subir. Embeddings con `google/gemini-embedding-2` para recuperar solo los fragmentos relevantes en cada respuesta.
- Nueva función `wa-sales-agent`: se llama desde `whatsapp-webhook` en mensajes entrantes cuando el agente está activo; usa `openai/gpt-6-astra` vía Responses con tools (`guardar_dato_perfil`, `calificar_lead`, `mover_etapa`, `escalar_a_asesor`, `crear_tarea`) y salida en streaming; registra en `ai_usage_log` y descuenta créditos.
- Respeta `wa_template_policy_check`, ventana de 24 h y el estado de toma de control existente (`BotTakeoverButton`).
- UI: nueva pestaña en `WhatsappTab`, indicador de estado en `ChatHeader`/`ConversationList`, panel de perfilado en `ContactSidePanel`; Asistente del Lead lee la misma base.
- Notificación de escalamiento vía `_shared/notifications.ts`.
