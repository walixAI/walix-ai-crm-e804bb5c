# Rastreo completo de leads: origen, embudo y reporte

## Respuestas rápidas
- **Botón "Tomar control" no aparece:** la secuencia simulada ya terminó, y hoy el botón solo sale mientras el bot sigue activo.
- **No están en Pipeline:** la entrada de leads solo crea el contacto, no la oportunidad (es uno de los 4 problemas pendientes).
- **Origen del lead:** se guarda, pero no se ve en ninguna pantalla.

## Qué voy a construir

1. **Arreglar los 4 problemas de la prueba**
   - Teléfonos de 10 dígitos se guardan con +52.
   - Contactos de WhatsApp guardan el nombre del perfil, no el número.
   - Los mensajes de WhatsApp desde anuncio (Click to WhatsApp) guardan campaña/anuncio de Meta.
   - Cada lead nuevo (web, formulario de Meta, WhatsApp) crea una oportunidad en la etapa inicial del embudo principal, asignada por reparto.
   - Crear las oportunidades faltantes de los 15 leads de prueba.

2. **"Tomar control" siempre disponible**
   - El botón aparece si el bot participó en la conversación y ningún asesor la ha tomado, aunque la secuencia ya haya terminado.

3. **Etiqueta de origen visible**
   - Etiqueta "WhatsApp (anuncio)", "Formulario Meta", "Sitio web", "Manual" en: lista de contactos, tarjeta del Pipeline, lista del Pipeline, chat de WhatsApp.
   - Filtro por origen en Contactos y Pipeline.

4. **Tarjeta "Origen y rastreo" en el detalle del contacto**
   - Primer y último contacto, número de visitas.
   - UTMs completos (source, medium, campaign, content, term), gclid/fbclid.
   - Meta: campaña, conjunto, anuncio, formulario, plataforma (FB/IG), ID de clic de WhatsApp.
   - Página de entrada, referente, ciudad/estado/país, dispositivo, navegador.
   - Canal GA4 calculado.

5. **Reporte "Recorrido de leads"** (en Reportes)
   - Tabla: lead, origen, campaña/UTM, fecha de entrada, fecha en que llegó a cada etapa, días en cada etapa, etapa actual, último resultado/tipificación, asesor.
   - Filtros: periodo, origen, campaña, asesor, etapa.
   - Resumen por origen y campaña: leads, avanzaron, ganados, conversión.
   - Exportar CSV.

## Detalles técnicos
- Normalización en `_shared/phone.ts` (`toE164` con 10 dígitos → +52).
- `lead-intake`, `meta-leadgen-webhook`, `whatsapp-webhook`: crear deal en primera etapa del pipeline por defecto; webhook guarda `profile.name` y `referral` (CTWA: source_id, ctwa_clid, headline) en `contact_attribution`.
- Se usan campos existentes de `contact_attribution` (39 columnas) y `deal_stage_history`; sin tablas nuevas.
- `BotTakeoverButton`: condición = existe enrollment (cualquier estado distinto de "stopped por asesor") y conversación sin asignar.
- `ContactAttributionCard` ampliada e integrada en `ContactDetail` y la vista simple.
- Nuevo `LeadJourneyReport` con consulta que une contactos, atribución, deals, historial de etapas y resultados de actividades.
