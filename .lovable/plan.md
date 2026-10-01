# Documento de entrega: WhatsApp en Walix para Utel

Documento Word (.docx) en español, tamaño carta, con el estilo azul de Walix. Va dirigido al Director de IT y al Director Comercial de Utel (SCALA HIGHER EDUCATION). Se entrega en Files como `Walix-WhatsApp-Handoff-Utel.docx`.

## Contenido

1. **Resumen ejecutivo**: qué hace Walix con WhatsApp, en una página.
2. **Cómo llega cada lead**: Meta Lead Ads, Click to WhatsApp, sitio web y Make.com o webhooks. Cómo se asigna cada lead al asesor con menos carga y cómo entra a la etapa "Nuevo".
3. **Rastreo de origen**: UTMs, Google Ads, Meta Ads, tarjeta "Origen y rastreo", reporte "Recorrido de leads" con score, fuentes de ingreso autorizadas y "Leads rechazados".
4. **Bandeja de WhatsApp**: conversaciones, etiqueta de origen, ventana de 24 h, plantillas aprobadas y "Tomar control" del bot.
5. **Bot "Enrollment New Lead"**: secuencia de los días 0, 1, 3 y 7, horario de lunes a viernes de 9:00 a 20:00 y en qué casos se detiene.
6. **Asistente de IA del asesor**: siguiente paso, mensajes sugeridos, guion de llamada y cuándo se actualiza.
7. **Control de gasto**: límites por lead, por asesor y por mes, autorización del gerente y devolución del crédito si Meta rechaza el mensaje.
8. **Sección para IT**: arquitectura general, aislamiento por empresa, llave de entrada, conexión del número con Meta (Embedded Signup y Tech Provider), plantillas y su aprobación (hasta 48 h), y seguridad de las credenciales.
9. **Posibles gastos**:
   - **WhatsApp Business (Meta)**: cobro por conversación de 24 h según categoría (marketing, utility, authentication y service). Contestar dentro de la ventana es gratis. Incluye una tabla con tarifas de referencia de Meta para México, marcadas como aproximadas y sujetas a cambio, y la equivalencia en créditos de Walix.
   - **IA**: qué consume créditos (Copiloto, Asistente del lead, comandos por WhatsApp, bot) y qué no. Incluye escenarios de ejemplo con 500, 2,000 y 5,000 leads al mes.
   - Planes y paquetes de créditos de Walix.
10. **Estado actual y pendientes**: hoy se usa un número de prueba ("PRUEBA"). Faltan las plantillas aprobadas por Meta, los textos reales de la beca y el número real. La empresa tiene 0 créditos y hay datos de prueba por borrar.
11. **Checklist de arranque**: lista de pasos para salir a producción.

## Detalles técnicos
- Generado con docx-js: encabezados, tablas con DXA y numeración real. Se valida con el script de la skill y se convierte a PDF para revisar visualmente.
- Las cifras de planes y créditos salen de la memoria del proyecto y de la tabla `plan_limits`. Las tarifas de Meta se confirman con una búsqueda web.
- El documento no incluye credenciales ni la llave de entrada. Solo explica dónde se consultan.
