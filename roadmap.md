# Llamadas entrantes de Refrigeración

## Minutos de llamadas
- [x] Mostrar tiempo acumulado total o por periodo y responsable, conservando segundos al sumar y exportando el desglose. 9 pruebas aprobadas; cuenta temporal autenticada comprobó mes (105 s), todo el historial (225 s), responsable (120 s), CSV y recarga; computadora/celular sin desbordamiento. Datos de muestra retirados, sin llamadas ni IA nuevas; no se usó la cuenta de Erick.

## Optimización de IA de llamadas
- [x] Segunda etapa: reserva persistente por llamada/transcripción con bloqueo de concurrencia; resultados inciertos no se repiten automáticamente. Omisión solo de marcadores exactos de silencio, saludos o mensaje estándar de buzón; audio y transcripción intactos. Catálogos con alias reversibles conservan etiquetas/relaciones, modelo y límite de salida.
- [x] Prueba real en empresa temporal: dos reservas simultáneas → una aceptada y una bloqueada, empresa ajena rechazada, resultado reutilizado, reanálisis explícito permitido sin concurrencia, silencio omitido y leído de vuelta. Pantalla autenticada muestra motivo, texto completo y análisis manual habilitado tras recarga; sin inferencia ni llamadas telefónicas nuevas. Datos temporales retirados. Calidad comparativa del nuevo formato y ahorro en créditos aún sin medición.
- [x] Registrar análisis automáticos explícitamente con tokens y asesor/solicitante; exclusión de QA conservada, sin descuentos nuevos ni ajustes históricos. Facturación lee todas las páginas del mes y distingue acciones de créditos.
- [x] Evitar sugerencias repetidas al escribir y reutilizar la tipificación guardada si coincide el resultado/comentario; actualización explícita y solicitudes idénticas deduplicadas por apertura.
- [x] 14 pruebas aprobadas y tres funciones desplegadas; sesión temporal comprobó sugerencia reutilizada sin IA nueva, escritura sin solicitudes y seguimiento guardado/leído. Datos temporales retirados. El registro de una inferencia nueva en producción no se ejercitó para evitar consumo adicional.
- [ ] Cuantificar ahorro real: requiere una ventana posterior con tráfico comparable y registros de consumo ya incorporados; no estimar porcentaje a partir de código.

## Periodo personalizado
- [x] Revisar consumidores de rangos personalizados, gráficas/actividad del tablero, vistas de oportunidades, consultas del Copiloto, exportaciones, periodos mensuales, procesos y funciones de base de datos; corregir límites incompletos sin cambiar registros ni permisos. 24 pruebas aprobadas; cobertura documentada. Pantalla con sesión del solicitante no verificada por falta de sesión disponible.
- [x] Corregir el rango del 1 al 23 de noviembre de 2026 para incluir el día final completo y exigir inicio/fin al cambiar un rango previo; 9 pruebas aprobadas y lectura real devuelve 21 estados de 2 asesores, excluyendo QA. Pantalla con sesión del solicitante no verificada: no hay sesión disponible.

## Correcciones en Reportes
- [x] Eliminar etapas duplicadas dentro de cada proceso del embudo; separar procesos y conservar conteos de oportunidades. Recorridos únicos por contacto con última oportunidad abierta.
- [x] Rediseñar recorrido con detalles desplegables, lista de alto limitado y páginas de 15; conversiones muestran origen, avances únicos y porcentaje, sin IA ni indicador de IA.
- [x] Actividad del equipo: llamadas entrantes/salientes, WhatsApp, email y otros tipos; periodo, usuario, páginas y Excel de todos los resultados filtrados.
- [x] Comprobar 18 oportunidades → 17 leads únicos y páginas 15+2, etapas duplicadas agrupadas, filtros combinados y lectura del Excel descargado con sesión temporal; 21 pruebas aprobadas, sin errores en computadora/celular. Datos temporales retirados.

- [x] Recibir y contestar entrantes en Walix desde el aviso verde, mantener celular opcional y resultados firmados; 43 pruebas aprobadas, aceptación/silencio/cierre comprobados con proveedor local simulado en 1280, 812 y 390 px, lectura autenticada de recepción comprobada en empresa temporal sin canal. No certifica audio telefónico real.
- [ ] Comprobar una llamada telefónica real contestada en Walix: requiere una llamada entrante y micrófono físico; no se hicieron llamadas con costo.

- [x] Configurar por empresa destinatarios de llamadas sin asesor (específico, todos, supervisión o asesores) y permisos de recepción, usando el teléfono actual del perfil; guardado y lectura tras recargar verificados, asesor sin autorización bloqueado y reporte accesible al destinatario.
- [x] Mostrar aviso verde con datos del llamante, timbre y voz; sonido y frase comprobados en navegador, modal visible en 1280, 812 y 390 px, no atendida leída en reporte; 36 pruebas aprobadas, datos temporales retirados, sin llamadas con costo. Falta probar aceptación y audio de una llamada telefónica real (pendiente existente).

- [x] Corregir recepción firmada de Twilio y avisar al responsable; sin asesor, fila configurada y administración/supervisión para no atendidas.
- [x] Mostrar reporte de entrantes no atendidas, número, fecha y responsable, sin perder registros por paginación.
- [x] Verificar avisos y reporte con sesión temporal de administrador, registros de prueba retirados y pruebas sin llamadas reales; computadora, tablet y móvil sin desbordamiento.
- [x] Avisar en Walix por defecto y permitir que cada usuario active o apague la recepción en su celular, con aviso de costo y número válido; guardado y lectura tras recargar comprobados.
- [x] Activar recepción real y leer de vuelta la configuración del número de Refrigeración en Twilio sin realizar llamadas con costo.
- [ ] Comprobar audio y aceptación con tecla 1 en una llamada real: requiere destinatario y prueba telefónica autorizada; no se hicieron llamadas reales.

# Tipificaciones: intentos y llamadas efectivas

- [x] Migración y clasificación en base de datos: hecho de conexión marcado, resultados de llamada asignados al tipo «Llamada saliente», tipificaciones finas creadas para Refrigeración.
- [x] Historial del contacto: etiqueta «Intento» / «Llamada efectiva» según estado y duración reales.
- [x] Marcador: un intento no conectado solo ofrece programar reintento; una llamada efectiva pide tipificación.
- [x] Registro de seguimiento: modo intento (solo siguiente paso) frente a modo efectiva (resultado + tipificación obligatoria si hay opciones).
- [x] La IA deja de sugerir hechos de conexión.
- [x] Indicadores en Llamadas: intentos, efectivas, tasa de conexión e intentos hasta conectar.
- [x] Explicar a Erick qué implica el esquema para el equipo de Refrigeración.

# Información unificada del prospecto

# Marcador con dos modalidades

- [x] Mantener Colgar en una franja fija fuera del contenido desplazable y compactar encabezado en pantallas bajas; comprobado visible y pulsable sin desplazamiento en siete tamaños, incluidos tablet, celular y horizontal. 10 pruebas aprobadas; llamadas de muestra sin gasto real.

- [x] Agregar selección real de micrófono/salida antes y durante llamadas por navegador; detección y actualización de dispositivos, permisos y aviso de incompatibilidad. 10 pruebas aprobadas y selección comprobada con dispositivos de muestra en 1280, 744 y 390 px. Celular controla altavoz/teléfono/Bluetooth en su pantalla de llamada.
- [ ] Comprobar audio con bocinas/audífonos/Bluetooth físicos durante llamada real: requiere dispositivo físico y sesión autorizada; no se hicieron llamadas nuevas.

- [x] Unificar cada intento en historial de contacto/oportunidad y reportes, conservando resultado automático, resumen IA y tipificación; aplica a entradas existentes/nuevas sin borrar evidencia. 17 pruebas aprobadas; presentación comprobada con datos de muestra en computadora y celular.
- [ ] Comprobar el historial unificado con sesión del solicitante: no hay sesión disponible para su cuenta; requiere iniciar sesión en la vista previa.

- [x] Animar transcripción real en proceso y mejorar conversación/resumen; 10 pruebas aprobadas, transición y cierre comprobados con datos de muestra en 1280, 744 y 390 px, movimiento reducido respetado. Sin llamadas nuevas.
- [ ] Comprobar la transcripción con una llamada real y sesión del solicitante: no fue posible obtener su sesión; requiere iniciar sesión en la vista previa.

- [x] Permitir a administradores y propietarios configurar permisos de llamadas por celular dentro de su empresa; 17 pruebas aprobadas. La comprobación autenticada sigue pendiente porque no se pudo obtener la sesión del solicitante.
- [x] Mejorar las ventanas del marcador con el estilo de Copiloto y permitir al propietario autorizar llamadas por celular para todos o usuarios seleccionados; control previo al proveedor desplegado, pruebas de permisos y marcador aprobadas, selector comprobado en computadora/móvil con datos de prueba.
- [ ] Validar guardado y lectura de permisos con propietario autenticado: no fue posible obtener la sesión del solicitante; requiere iniciar sesión en la vista previa. No se hicieron llamadas reales.
- [x] Implementar celular y computadora, callbacks firmados, resultados automáticos separados de tipificación manual y transcripción IA de grabaciones; pruebas del marcador y eventos aprobadas.
- [ ] Activar computadora y validar llamadas/transcripción reales: requiere Auth Token de la subcuenta capturado en el canal, sesión autorizada del solicitante y destinatario de prueba; la sesión del solicitante no pudo obtenerse.

# Auditoría integral solicitada

- [x] Avisos de monitoreo del 12 de noviembre: corregida selección enabled, contador definido y consultas de los tres disparadores contra columnas vigentes; función desplegada y rechazo 401 comprobado. Cuatro pruebas del proceso cubren disparadores y fallo de consulta sin envíos reales; ejecución real de la siguiente agenda aún no observada. Reportes actualizan con clave estable y fechas resueltas en cada consulta; prueba de actualización pendiente conserva datos y pantalla autenticada de SXP comprobada durante 65 segundos. Compilación sin errores; no se modificaron otros avisos.

- [ ] Secuencia autorizada el 12 de noviembre: (1) comunicaciones legítimas, (2) duplicados y seguridad de correo, (3) dependencias, (4) validación por empresa/rol, (5) decisiones de fechas, (6) nuevo análisis y cierre. No habilitar demos ni implementar la propuesta del chat público; solicitar destinatarios/costos antes de pruebas con envíos reales.
- [ ] Paso 1: sesión autenticada de SXP comprobada. Erick autorizó ambos envíos normales exclusivamente a teléfono +525517278186 y correo saulerick@gmail.com, con costo habitual. Correo enviado el 12 de noviembre a las 06:33 UTC desde info@studentxperience.com; respuesta 200 y lectura en pantalla comprobadas; Erick confirmó recepción. El 12 de noviembre Erick autorizó acreditar el paquete más pequeño: 100 créditos WA (catálogo $249 MXN), sin ejecutar ni confirmar cobro. Acreditación única de noviembre comprobada. La plantilla sxp_retomar_conversacion enviada desde pantalla fue rechazada por Meta 131008 (nombre faltante; crédito devuelto); reintento con params ['Erick'] aceptado por Meta a las 07:21 UTC, no simulado, registrado y leído en pantalla, con consumo de 2 créditos. Espera confirmación de recepción de Erick. Candidato detectado: PaidTemplateBar deriva parámetros de variables y no del BODY {{1}}; revisar antes de certificar el flujo de plantillas desde pantalla. Lectura de buzón programada comprobada; telefonía depende de número configurado. No adelantar paso 2 mientras falte confirmar recepción; demos de plataforma apagadas.

- [x] Bloque 1: función administrativa retirada; prueba y rechazo desplegado 410 comprobados; registros disponibles no demuestran uso indebido.
- [x] Bloque 2: permisos de automatizaciones/claves de entrada, roles del copiloto, consultas privilegiadas, importaciones y envíos segmentados reforzados; credenciales sin lectura de usuarios; chat público sin identidad CRM heredada; cachés privadas limpiadas.
- [x] Bloque 4: comparativos constantes retirados, tasa real por cierre, lost_at estable, reportes relativos y paginación de indicadores/diagnóstico; eliminación con respaldo y recuperación; 76 pruebas de aplicación y una de función retiradas aprobadas.
- [ ] Validar los bloques 2 y 4 en pantalla con sesión autorizada, incluidos Ariela, cambios de empresa y recuperación de archivos — no pudo obtenerse la sesión de Erick.
- [ ] Resolver significado de «Creadas en el periodo» y «Hoy» — espera decisión de Erick; comportamiento conservado.
- [ ] Fechas de pérdida históricas: 138 sin fecha confiable en la nueva columna; no usar última edición ni inventar fecha — espera confirmar criterio de recuperación histórica.
- [ ] Segunda etapa: validación integral y dependencias siguen pendientes; el 12 de noviembre Erick autorizó explícitamente corregir los 37 avisos seleccionados, incluyendo comunicaciones y procesos afectados.
- [x] Avisos seleccionados: autenticación de seis procesos internos, cinco agendas autenticadas, firmas de Meta, rechazo de roles falsos, permisos de identidad/pronósticos, invitaciones pendientes y destinos de correo públicos; 80 pruebas aprobadas y rechazos en funciones desplegadas comprobados.
- [ ] «1. Propuesta para el chat público»: pausada por Erick; recordársela al retomar auditoría, sin implementar límites todavía.
- [x] Decisión de Erick: demos de WhatsApp apagadas con bloqueo previo a cualquier envío; solo habilitarlas por petición expresa en este chat. Copias de correo conservadas, aviso residual activo.
- [x] Comprobar integridad de datos en las 14 empresas y controles anónimos; sin certificar aislamiento autenticado.
- [x] Ejecutar 61 pruebas existentes y revisar acciones/permisos por código; 20 rutas privadas comprobadas sin sesión.
- [x] Revisar seguridad de interfaz, funciones y base de datos; entregar diagnóstico con hallazgos y cobertura explícita, sin cambios comerciales.
- [x] Incorporar análisis profundo terminado: aislamiento de importaciones, envíos y chat público reforzado; procesos, avisos y dependencias reservados para segunda etapa. No certifica seguridad total.
- [ ] Verificar acciones autenticadas por empresa y rol — pendiente de una sesión autorizada; la cuenta del solicitante no pudo obtenerse automáticamente.

# Nombres de documentos

- [x] Acortar automáticamente títulos al subir, editar y adjuntar documentos; envíos del asesor y agente desplegados.
- [x] Contener nombres largos en biblioteca y conversaciones; cinco pruebas aprobadas y compilación sin errores.
- [ ] Verificar subida y envío en pantalla como asesor — requiere iniciar sesión en la vista previa; no se pudo obtener sesión para Erick.

# Correcciones de gestión del asesor

- [x] Corregir acceso al canal del asesor sin exponer credenciales; envío desplegado y borrador conservado cuando falla.
- [x] Corregir enlace de WhatsApp desde Kanban; prueba de navegación aprobada.
- [x] Permitir reasignación segura del propio contacto con oportunidades abiertas, conversaciones y tareas pendientes.
- [x] Evitar que nuevas oportunidades hereden el programa anterior; selección explícita prevalece al crear.
- [x] Centralizar edición de nombre y monto en el modal gris de Oportunidad; 13 pruebas aprobadas y compilación sin errores.
- [ ] Verificar envío, reasignación y creación completos en pantalla como asesor — no pudo obtenerse la sesión de Erick; requiere iniciar sesión en la vista previa.

# Roles del equipo

- [x] Permitir al propietario cambiar roles desde Configuración > Equipo con validación del tenant y registro del cambio.
- [x] Tres pruebas de solicitud aprobadas y rechazo sin sesión comprobado; pantalla compilada sin errores.
- [ ] Verificar cambio y lectura en pantalla con propietario autenticado — no pudo obtenerse sesión de Erick; requiere iniciar sesión en la vista previa. Authenticated path: UNVERIFIED.

# Detalle de oportunidad y perfilamiento

- [x] Quitar resumen del prospecto, siguiente paso, alertas, mensajes, guion y bloques bajo Notas; conservar propuesta PDF Pro.
- [x] Autocompletar programa y monto desde perfilamiento con datos confirmados o precio de catálogo, sin inventar precios; conservar cambios manuales del asesor.
- [x] Comprobar sincronización con prueba temporal revertida, oportunidades cerradas intactas y dos pruebas de selección aprobadas; pantalla compilada sin errores.
- [ ] Verificar el detalle y guardado desde la pantalla con sesión de asesor — no se pudo obtener sesión para la cuenta de Erick; requiere iniciar sesión en la vista previa.

# Ajustes de contactos y oportunidades

- [x] Unificar etapa vigente, nombre por producto e historial con responsables; datos de Juan Manuel verificados. Los responsables históricos ausentes se muestran como no registrados.
- [x] Colocar perfilamiento debajo de tareas, última actividad primero y etapa bajo el nombre.
- [x] Facilitar edición del nombre y simplificar Actividades.
- [x] Preseleccionar la última oportunidad activa en seguimientos; ocho pruebas aprobadas.
- [ ] Verificar edición y seguimiento en pantalla con sesión de asesor — la cuenta de Erick no pudo abrirse automáticamente; requiere iniciar sesión en la vista previa.

# Desplazamiento en computadora

- [x] Eliminar desplazamiento anidado accidental y la barra duplicada del Pipeline; comprobar estilos compilados y desplazamiento por teclado.
- [ ] Verificar las secciones con datos reales en computadora — requiere que Erick inicie sesión en la vista previa; no hay sesión disponible para su cuenta.

# Atención humana pendiente

- [x] Sustituir bloques locales por pleca persistente debajo de Copiloto y comprobar navegación (sin pendientes reales en la sesión; visualización con datos simulados).
- [x] Avisar del límite diario del bot al asesor, supervisor y administradores del tenant; verificar y desplegar.
- [x] Diagnosticar y reparar tareas y avisos de transferencia.
- [x] Mostrar modal y atención pendiente en WhatsApp, Mi día e Inbox, según asesor/supervisor.
- [x] Destacar y priorizar pendientes en Kanban, Lista y Desempeño.
- [x] Verificar transferencia y atención desde las pantallas.

- [x] Compartir resumen, perfil y seguimiento entre WhatsApp, contacto y oportunidad.
- [x] Unificar probabilidad comercial sin confundirla con completitud del perfil.
- [x] Persistir y actualizar la información de la conversación y recuperar el prospecto actual.
- [x] Comprobar las tres vistas y pruebas del flujo.

# Conversación consultiva de Mariana

- [x] Adaptar tono, objetivo y ejemplos al enfoque B2B ágil solicitado, conservando conocimiento y horarios aprobados.
- [x] Verificar la configuración guardada y su incorporación a las instrucciones del agente.
# Módulo de Email

- [x] Base de datos, permisos y cifrado de credenciales.
- [x] Cuentas IMAP/SMTP (propias y genéricas), modo de envío por tenant, firma.
- [x] Bandeja (asesor ve sus leads; dueño/admin/gerente ven todo), pestaña Email en contacto, plantillas, adjuntos.
- [x] Envío masivo con Brevo, SendGrid, Mandrill, SES, Mailgun y SMTP; bajas, rebotes, métricas.
- [ ] Conexión con un clic de Google y Microsoft — espera que Erick registre la app de Walix en Google Cloud y Microsoft Entra.

- [x] Módulo Documentos (categorías, permisos asesor/bot, adjuntar en WhatsApp/Email, envío por Agente)

# Reporte de llamadas de Refrigeración

- [x] Revisar qué muestra hoy el reporte de llamadas (no atendidas, intentos, tasa de conexión, responsables) y decidir qué falta.
- [x] Separar salientes y entrantes con su propio resumen: marcadas/efectivas/tasa/intentos hasta conectar y recibidas/atendidas/no atendidas/tasa de atención; comprobado con datos reales de Refrigeración (18 marcadas, 9 efectivas, 50%, 6 recibidas, 0 atendidas, 5 no atendidas).
- [x] Filtrar todo el reporte por periodo (Hoy, Esta semana, Este mes, Últimos 3 meses, personalizado) con las fechas resueltas dentro de cada consulta; al cambiar a Hoy quedaron 0 salientes y 3 entrantes no atendidas.
- [x] Tabla por responsable con salientes, efectivas, tasa, entrantes, no atendidas y última actividad, ordenable; sin asesor aparece como «Grupo de recepción · sin asignar».
- [x] Exportar CSV con resumen, desglose por responsable y el número de cada entrante no atendida; archivo descargado y leído, 22 líneas con el nombre de la empresa.
- [x] 5 pruebas nuevas del reporte y 169 pruebas del proyecto aprobadas; pantalla comprobada como propietario de Refrigeración en 1280 px.

## Estados del asesor (Contact Center)
- [x] Estados, pausas, bitácora con conexión/desconexión y horarios, tablero en vivo y CSV
- [ ] Estado automático "En llamada" al contestar y pantalla para editar motivos/tiempos máximos

## Quién terminó la llamada
- [x] Guardar responsable y horario de cierre con evidencia, sin atribuir llamadas históricas; Colgar en Walix identifica asesor, fallo/ocupado identifica sistema, completed genérico no identifica persona.
- [x] Mostrar el cierre en historial, análisis y ficha del contacto, leyendo la llamada original con alcance de empresa/contacto.
- [x] Verificar lectura de las tres vistas con sesión temporal y datos guardados, bloqueo de edición directa, computadora/móvil y 57 pruebas aprobadas; sin llamadas con costo.
- [ ] Validar cierre durante llamada real: requiere llamada telefónica autorizada; Twilio no identifica automáticamente al prospecto o al asesor que cuelga desde celular con sus callbacks actuales.
