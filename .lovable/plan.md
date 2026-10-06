# Agente de ventas por Pipeline: multicanal, con objetivos flexibles y modo autónomo

## Idea central
Cada Pipeline de cada empresa tiene **su propio agente**. Ese mismo agente, con el mismo conocimiento y el mismo objetivo, atiende en tres lugares:
- **WhatsApp** (le escribe y contesta al lead).
- **Chat web** (burbuja en el sitio de la empresa).
- **Copiloto del asesor** dentro de Walix (le sugiere qué decir y qué hacer).

Así el lead escucha lo mismo en todos lados, y el asesor ve exactamente lo que el agente dijo y en qué canal.

## Dónde se configura
**Configuración → Agentes de ventas**: una tarjeta por Pipeline (ej. "Admisiones Educativas", "Mantenimientos"). Al crear un Pipeline nuevo, su agente nace apagado con valores base.

Cada agente tiene:

1. **Identidad**: nombre, tono, idioma, lo que nunca debe hacer.
2. **Base de conocimiento**: fichas de texto, preguntas frecuentes, PDFs, ligas web y productos de Walix. Puede haber conocimiento común de la empresa + conocimiento propio del Pipeline.
3. **Objetivos (cambiables cuando quieras)**:
   - Un **objetivo por defecto** (ej. "Lograr la inscripción").
   - **Reglas de objetivo** que lo sustituyen según dimensiones, con prioridad:
     - Tipo/origen del lead (Meta, web, WhatsApp, referido, programa de interés).
     - Temporada o fechas (ej. "Del 1 al 31 de octubre: promover beca 50%").
     - Etapa del Pipeline.
     - Tipo de asesor asignado (equipo, rol o asesor específico).
     - Etiquetas, ciudad, calificación del lead.
   - Cada regla define: objetivo, mensaje clave/promoción, nivel de autonomía y cuándo pasar al asesor.
   - Vista previa: "Para este lead aplica el objetivo X por la regla Y".
4. **Perfilado**: preguntas clave que el agente obtiene y guarda en el contacto; calificación frío/tibio/caliente y puntuación 0-100; reglas para mover de etapa.
5. **Handoff al asesor**: lead caliente, pide una persona, pregunta sin respuesta, queja, N mensajes sin avance, o lo que defina la regla de objetivo. Al pasar: el agente se calla en todos los canales, avisa al asesor con resumen y crea tarea "Contactar ahora". El asesor puede "Tomar control" o "Devolver al agente".
6. **Nivel de autonomía** (por defecto y por regla):
   - **Solo sugiere**: redacta, el asesor envía.
   - **Mixto**: responde solo fuera de horario o si el asesor tarda X minutos.
   - **Autónomo**: persigue el objetivo por sí mismo hasta lograrlo o escalar.

## ¿Cuántos agentes por Pipeline?
- El modelo base es **un agente por Pipeline** (titular). Si la empresa lo necesita, se pueden crear **agentes adicionales que se reparten los leads por cualquier dimensión**, no solo el origen: fuente (ej. uno solo para Facebook/Meta), programa o producto de interés, ciudad, etapa, tipo de asesor asignado, etiquetas, calificación o temporada.
- Los agentes del mismo Pipeline **comparten la misma base de conocimiento** (y pueden compartir identidad); lo que cambia entre ellos es objetivo, autonomía, condiciones de reparto y topes de gasto.
- **Regla de resolución (determinista, un solo responsable por lead):**
  - Gana el agente con el reparto más específico (más condiciones coincidentes); si empatan, gana el de mayor prioridad; nunca hay dos agentes escribiendo al mismo lead.
  - Un agente puede ser el **"para todo lo demás"**: si ningún agente especializado coincide, lo atiende el agente por defecto del Pipeline.
  - Si no hay agente por defecto o el agente está apagado, el lead **pasa a atención manual del asesor asignado** (con aviso y tarea), de modo que todo lead queda atendido siempre: por un agente o por un asesor.
- **Cobertura visible**: en la configuración del Pipeline, un panel "¿Quién atiende a quién?" muestra qué parte de los leads cubre cada agente y **alerta si hay leads que nadie cubre** (para que la empresa decida: crear agente, designar por defecto o dejarlo en manual).
- El consumo (IA y WhatsApp) se registra por agente, así la empresa ve cuánto cuesta atender cada segmento de captación.
- Casos de uso: apagar solo el agente de Meta sin afectar el resto, objetivos o topes distintos por segmento, o métricas separadas por fuente.

## Modo autónomo: cómo busca la inscripción
- Planea los pasos hacia el objetivo (perfilar → resolver dudas → enviar requisitos/precio → agendar → cerrar) y va marcando el avance en el contacto.
- Contesta en WhatsApp y chat web, hace seguimiento cuando el lead se enfría (con plantillas aprobadas y respetando los límites de gasto que ya existen), agenda citas, mueve la Oportunidad de etapa y la marca como ganada solo si la regla lo permite; si no, la deja lista y avisa al asesor.
- Topes: respuestas por lead al día, plantillas pagadas, y créditos de IA por agente al mes. Al llegar al tope, pasa al asesor.
- Todo lo que hace queda en la línea de tiempo del contacto con el canal y el motivo.

## Una sola memoria para todos los canales
- Una conversación del lead une lo que pasó en WhatsApp, chat web y las notas del asesor.
- El agente siempre lee esa historia completa antes de responder, en cualquier canal.
- Si el lead empieza en la web y sigue por WhatsApp, el agente lo reconoce (por teléfono o correo) y continúa donde iba.

## Chat web
- Código corto para pegar en el sitio de la empresa (una línea por Pipeline/agente).
- Pide nombre y teléfono o correo al inicio para crear el contacto y la Oportunidad en ese Pipeline.

## Copiloto del asesor
- En la Oportunidad, el Contacto y la Bandeja: "Siguiente paso según el objetivo", mensajes listos con la voz del agente, y estado del agente (activo / escalado / asesor).
- El Asistente del Lead actual se alimenta de este mismo agente.

## Pruebas y control
- "Probar agente": chat de prueba que simula canal y tipo de lead para ver qué objetivo aplica.
- Registro de consumo por agente en "Consumo del mes" (IA y WhatsApp).
- Apagado al inicio en todas las empresas; se enciende por Pipeline.

## Fuera de alcance por ahora
- Llamadas de voz, cobros dentro del chat, calendario externo (Google Calendar), Instagram/Messenger.

## Detalles técnicos
- Tablas (todas con `tenant_id`, RLS `get_user_tenant(auth.uid())` y GRANTs):
  - `sales_agents` (varios por `pipeline_id` permitidos pero con reparto de orígenes sin traslape; `source_kinds` nulo = atiende todos; identidad, autonomía por defecto, topes, canales activos). El núcleo elige el agente responsable del lead por origen antes de responder.
  - `sales_agent_knowledge` (scope tenant o agente; tipo texto/faq/pdf/url/producto; contenido; embedding `google/gemini-embedding-2`).
  - `sales_agent_goal_rules` (prioridad, condiciones jsonb: source_kind, programa, fechas, stage_ids, owner_ids/roles, tags, score; objetivo, mensaje clave, autonomía, reglas de handoff, permitir cerrar).
  - `sales_agent_sessions` (por contacto+agente: estado activo/escalado/asesor, regla aplicada, plan y avance, datos perfilados, score, último canal).
  - `web_chat_sessions` / mensajes web con `channel='web'` en la misma línea de conversación.
- Trigger al crear `pipelines` → crea `sales_agents` apagado.
- Núcleo compartido `_shared/sales-agent.ts`: resuelve regla de objetivo, arma contexto (historia multicanal + fragmentos de conocimiento), llama `openai/gpt-6-astra` por Responses con streaming y tools (`guardar_perfil`, `calificar`, `mover_etapa`, `marcar_ganada`, `agendar`, `crear_tarea`, `escalar`, `enviar_whatsapp`), registra en `ai_usage_log` y descuenta créditos con el motor de la empresa.
- Entradas: `whatsapp-webhook` (entrantes), nueva función `web-chat` (pública con llave por agente, límite de frecuencia), `wa-sales-agent-worker` cron para seguimientos autónomos, y `lead-assistant`/Copiloto reutilizan el núcleo en modo sugerencia.
- Respeta `wa_template_policy_check`, ventana de 24 h y `BotTakeoverButton` (extendido a "Devolver al agente").
- UI: nueva sección en Configuración, editor de reglas con vista previa, panel de estado en `ChatHeader`/`ContactSidePanel`/DealDrawer, widget web embebible.
- Fases sugeridas: (1) agente por Pipeline + conocimiento + reglas + copiloto en modo sugerencia; (2) WhatsApp mixto/autónomo + handoff; (3) chat web + memoria unificada.
