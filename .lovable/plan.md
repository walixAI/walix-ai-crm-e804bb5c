# Plan de corrección y validación de Walix

## Objetivo
Corregir los hallazgos de la auditoría sin alterar datos comerciales ni interrumpir procesos legítimos, y responder por cada flujo: **cumple, no cumple o falta verificar**, con evidencia.

## 1. Contención inmediata — prioridad crítica
- Retirar o bloquear la función administrativa de pruebas que permite crear usuarios, cambiar contraseñas y asignar roles sin autorización. Eliminar el cambio de contraseña de cuentas existentes de ese mecanismo.
- Comprobar que solicitudes sin sesión y usuarios sin permiso quedan rechazados antes de cualquier modificación.
- Revisar registros disponibles para detectar uso indebido; si hay indicios de compromiso, identificar las cuentas afectadas y definir recuperación y rotación. No afirmar que hubo un ataque sin evidencia.

**Cierre:** ninguna invocación no autorizada puede administrar usuarios; prueba negativa y verificación desplegada.

## 2. Aislamiento y permisos — prioridad alta
- Revisar las funciones privilegiadas detectadas, empezando por consultas de contactos/oportunidades y suscripciones: retirar accesos públicos innecesarios y validar empresa, usuario y propiedad donde corresponda. Conservar usos internos autorizados.
- Hacer coincidir los permisos de automatizaciones entre pantalla y base de datos, respetando la matriz vigente.
- Limitar el copiloto a los roles de la empresa activa.
- Impedir que credenciales cifradas y tokens de canales lleguen al navegador; mantener acceso a metadatos seguros y configuración autorizada.
- Separar y limpiar consultas e informes guardados al cerrar sesión o cambiar usuario/empresa.
- Evitar que el chat público atribuya una conversación a un contacto existente solo por un teléfono o correo declarado, sin comprobar identidad.

**Cierre:** pruebas positivas de acceso permitido y negativas entre empresas, entre asesores y entre roles; cambiar de sesión no muestra datos anteriores.

## 3. Protección de comunicaciones y procesos — prioridad alta
- Restringir cada actualización de telefonía a su canal y empresa; verificar la autenticidad de avisos según el proveedor y evitar efectos duplicados.
- Proteger los procesos programados de correo y campañas frente a invocadores no autorizados y ejecuciones simultáneas duplicadas; actualizar conjuntamente sus invocaciones legítimas.
- Validar destinos de correo, bloquear redes privadas/reservadas, restringir puertos y conexiones inseguras; no reutilizar una contraseña guardada si cambia el destino.
- Actualizar las dependencias con avisos de vulnerabilidad de forma compatible y ejecutar pruebas de regresión.

**Cierre:** avisos e invocaciones falsos rechazados; procesos legítimos conservados; avisos de dependencias resueltos o documentados por aplicabilidad.

## 4. Exactitud de resultados y manejo de fallas
- Sustituir comparativos constantes del tablero por cálculos reales del periodo comparable; mostrar ausencia de datos cuando no exista base de comparación.
- Usar una fecha de pérdida estable, no la última edición. Para históricos sin evidencia suficiente, no inventar una fecha.
- Corregir rangos relativos de reportes y comprobar paginación y totales, especialmente en Refrigeración con más de 2,000 oportunidades.
- Robustecer eliminación de documentos/categorías: comprobar errores y permitir recuperación de fallas parciales sin anunciar éxito falso.
- Conservar la corrección de oportunidades activas anteriores al periodo y probar el caso de Ariela en pantalla.
- Presentar antes de cambiar dos decisiones funcionales: significado literal de «Creadas en el periodo» y si «Hoy» incluye también las tareas vencidas durante el día. Hasta acordarlo, conservar su comportamiento y señalar la ambigüedad.

**Cierre:** resultados contrastados con datos de origen, pruebas de fechas límite y fallas, y lectura del resultado desde la pantalla.

## 5. Validación integral por empresa y rol
- Mantener una matriz de las 14 empresas, roles disponibles, módulos habilitados, acciones, resultado esperado, evidencia y bloqueadores.
- Probar contactos, oportunidades y sus tres vistas, filtros, tareas, seguimiento, atención humana, documentos, equipo, configuración, reportes y comunicaciones donde estén habilitados.
- Ejercitar crear, editar, guardar, releer, reasignar y mover etapas con registros controlados; comprobar también denegaciones y separación entre empresas.
- Verificar estados vacíos, errores, doble clic, concurrencia y presentación en computadora y celular. Las empresas sin usuarios o sin módulo configurado quedarán identificadas, no declaradas aprobadas.
- Obtener sesiones únicamente de cuentas autorizadas. No elegir cuentas ajenas ni pedir contraseñas.
- Separar pruebas sin envío de las llamadas/mensajes/correos reales. Confirmar destinatarios y costos antes de generar comunicaciones.
- La llamada real de Refrigeración queda condicionada a aprobación del registro, compra del número y configuración de Twilio; no bloquea las correcciones de seguridad.

**Cierre:** cada flujo probado tiene resultado y evidencia; lo no ejercitado permanece «sin verificar», con su causa.

## Método técnico de ejecución
- Trabajar en bloques pequeños: reproducir → corregir → agregar prueba concreta → ejecutar pruebas → desplegar cambios aplicables → verificar comportamiento real.
- Revisar políticas, permisos de ejecución y funciones desplegadas; no considerar suficiente ocultar botones.
- Preparar cambios de permisos junto con sus consumidores para no romper campañas, agente, correo o telefonía.
- No ejecutar pruebas destructivas sobre registros comerciales ni relajar aislamiento para facilitar la validación.
- Repetir análisis de seguridad y contrastarlo con la revisión manual. Los resultados disponibles actualmente son anteriores a esta auditoría y no confirman la finalización del análisis profundo.

## Entrega y criterio de finalización
Entregar por bloque: hallazgos corregidos, pruebas realizadas, riesgos residuales y pendientes con bloqueador. El cierre general exige pruebas de regresión aprobadas, ningún hallazgo crítico/alto confirmado sin tratar y comprobación autenticada de los flujos cubiertos. No equivale a prometer ausencia absoluta de errores ni a certificar acciones que no se probaron.

**Esta aprobación autoriza comenzar las correcciones; las sesiones de otras cuentas y pruebas con gasto conservarán sus confirmaciones correspondientes.**