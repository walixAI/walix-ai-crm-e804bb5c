# Seguimiento automático por WhatsApp (Campañas y Secuencias)

Activarlo primero solo para **SCALA / Utel**, con un interruptor por tenant (`feature_wa_campaigns`), igual que hicimos con recurrencias y gastos. El resto de tenants no ve nada nuevo.

## Qué se construye

### 1. Entrada de leads unificada
Todo lead nuevo entra por el mismo punto, sin importar el origen:
- Alta manual en Contactos
- Importación por archivo
- Formularios de Meta Ads (webhook de leadgen)
- Formulario de sitio web / API pública (endpoint con llave por tenant)

Cada lead queda marcado con su **canal de origen** (meta_ads, web, api, manual, importación) y su **tipificación** (producto, campaña de origen, etiquetas).

### 2. Reglas de enrolamiento
Una pantalla nueva **Campañas de WhatsApp** donde se define:
- **Condición de entrada**: canal de origen, producto/categoría, etiqueta, asesor, etapa del pipeline.
- **Objetivo de la conversación**: calificar, agendar cita, cotizar, reactivar, cobrar, encuesta.
- **Secuencia**: pasos con espera (ej. día 0 plantilla de bienvenida, día 2 recordatorio, día 5 último intento).
- **Corte automático**: si el lead responde, avanza de etapa o se marca ganado/perdido, la secuencia se detiene.
- **Horario permitido**: no enviar de noche ni en fines de semana (configurable).

El primer lead que cumpla más de una regla entra solo a la de mayor prioridad.

### 3. Mensajes que sí se pueden enviar
- **Paso 1 (abrir conversación)**: plantilla aprobada de Meta. Sincronizamos las plantillas ya aprobadas de la cuenta WhatsApp del tenant y se eligen desde un selector, mapeando sus variables a datos del contacto (nombre, empresa, producto, asesor, monto).
- **Pasos siguientes dentro de 24h**: texto libre normal.
- Si la ventana de 24h ya se cerró, el paso vuelve a usar plantilla automáticamente; si no hay plantilla válida, el paso queda pendiente y se avisa al asesor en lugar de fallar en silencio.

### 4. Envíos automáticos con bitácora completa
Los mensajes salen solos (sin aprobación), y Walix registra por cada lead y cada paso:
- **Estado** del envío (programado, enviado, entregado, leído, falló, cancelado)
- **Etapa** del pipeline en la que estaba el lead al enviarse
- **Resultado** (respondió, no respondió, agendó, rechazó, número inválido)
- **Tipificación** del resultado y **comentario** (automático del sistema o escrito por el asesor)

Todo esto aparece en el timeline del contacto, en la conversación del Inbox y en un panel de la campaña con métricas: enviados, entregados, respondidos, tasa de respuesta, avance de etapa y oportunidades generadas.

### 5. Envío puntual por segmento
Desde Contactos y Pipeline: seleccionar filtros (etapa, tipificación, asesor, producto, origen, antigüedad), ver el conteo de impactados, elegir plantilla o texto, previsualizar con datos reales y enviar. Queda registrado igual que una campaña, con su bitácora y métricas.

## Detalles técnicos

**Base de datos** (todas con RLS por `get_user_tenant(auth.uid())` + GRANTs):
- `tenants.feature_wa_campaigns` (boolean, default false; true solo para SCALA)
- `wa_templates` — caché de plantillas aprobadas de Meta por tenant (nombre, idioma, categoría, variables, estado)
- `wa_campaigns` — nombre, objetivo, condiciones de entrada (jsonb), prioridad, horario, activa
- `wa_campaign_steps` — orden, espera en horas, tipo (plantilla/texto), contenido, condición de corte
- `wa_enrollments` — contacto + campaña, estado, paso actual, próximo envío, motivo de salida
- `wa_step_sends` — bitácora por envío: estado, etapa del deal, resultado, tipificación, comentario, id de mensaje de Meta
- `lead_intake_keys` — llave por tenant para el endpoint público de leads

**Funciones edge**:
- `lead-intake` — endpoint público (API y formularios web) que crea contacto + enrola
- `meta-leadgen-webhook` — recibe formularios de Meta Ads
- `wa-campaign-worker` — corre cada 15 min por cron; lote acotado, lock de ejecución única, marca progreso idempotente, se pausa y avisa ante errores repetidos de Meta
- Ampliar `whatsapp-send` para soportar `type: template` con variables
- Ampliar `whatsapp-webhook` para registrar respuestas y estados (entregado/leído) contra `wa_step_sends` y cortar la secuencia al responder

**Frontend** (todo en español, oculto si el interruptor está apagado):
- `src/pages/app/Campaigns.tsx` con lista, constructor de secuencia y panel de métricas
- Diálogo de envío por segmento reutilizable desde Contactos y Pipeline
- Bloque de campaña en el detalle del contacto y en la conversación del Inbox
- Interruptor del módulo en Configuración → General

## Orden de entrega
1. Base de datos, interruptor y sincronización de plantillas de Meta
2. Entrada de leads (manual, importación, web/API, Meta Ads)
3. Constructor de campañas + worker de secuencias + bitácora
4. Envío puntual por segmento y panel de métricas
