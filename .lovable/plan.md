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

### 1b. Atribución: UTMs, canal estándar y geolocalización
Cada contacto guarda su **atribución de primer toque** (first touch, inmutable) y la de **último toque** (last touch, se actualiza en cada nueva interacción rastreable), y cada oportunidad hereda la atribución vigente al crearse.

Se captura:
- **UTMs**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, más `gclid`, `fbclid`, `msclkid`, `wbraid`/`gbraid`.
- **Canal estándar de Google Analytics** (agrupación por defecto): Direct, Organic Search, Paid Search, Organic Social, Paid Social, Display, Email, Affiliates, Referral, Organic Video, Paid Video, Cross-network, Unassigned. Se calcula con las mismas reglas de GA4 (combinación de source/medium/campaign) y se guarda ya resuelto para poder segmentar y reportar sin recalcular.
- **Página de aterrizaje**, **referrer**, y **landing URL completa**.
- **Rastreo técnico y geográfico**: IP, país, estado/región, ciudad, código postal aproximado, zona horaria, idioma del navegador, dispositivo (móvil/escritorio/tablet), sistema operativo, navegador y user agent. La resolución de IP a ciudad/estado se hace en el servidor al recibir el lead (no en el navegador), así no se puede falsear desde el cliente.
- **Marca de tiempo** de primer y último toque y número de toques.

En Contactos y Pipeline estos campos quedan disponibles como **filtros y columnas**, y sirven como condición de entrada a las campañas de WhatsApp (ej. "leads de Paid Social de CDMX entran a la secuencia X"). En el detalle del contacto se ve una tarjeta de "Origen" con todo el rastro.

**Aviso de privacidad**: la IP y la geolocalización se guardan como dato de negocio; conviene reflejarlo en el aviso de privacidad del tenant. Se puede apagar el guardado de IP por tenant.

### 1c. Mapeo de formularios de Meta Ads
Meta no envía UTMs: envía `ad_id`, `adset_id`, `campaign_id`, `form_id`, `page_id`, `platform` (facebook/instagram) y los campos personalizados del formulario. Por eso se agrega una pantalla de **mapeo por formulario**:
- Lista de formularios detectados de la cuenta de Meta del tenant.
- Para cada uno, se define a mano a qué valor de UTM corresponde: por ejemplo `utm_source = facebook`, `utm_medium = paid_social`, `utm_campaign = {{campaign_name}}`, `utm_content = {{ad_name}}`, `utm_term = {{adset_name}}`. Se pueden usar valores fijos o tokens con los datos que Meta manda.
- Mapeo de los **campos del formulario** (nombre completo, teléfono, correo, preguntas personalizadas) hacia campos del contacto o campos personalizados.
- Regla por defecto para formularios nuevos aún no mapeados, para que ningún lead se pierda, y aviso en pantalla de que hay formularios sin mapear.


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
