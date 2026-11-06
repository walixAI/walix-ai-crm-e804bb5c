# Agente de Refrigeración y nombre automático de la oportunidad

Solo para el tenant **Refrigeración González y Rodríguez**. SCALA, SXP y los demás tenants no cambian.

## 1. Agente exclusivo de Refrigeración
- Se crea un **agente nuevo, «Agente Refrigeración GyR»**, que pertenece solo a este tenant. Otros tenants no lo ven ni lo usan.
- Se asigna al embudo **Servicio y Mantenimiento**, y el agente genérico que se creó automáticamente se desactiva (no se borra).
- Todo lo que lo hace distinto vive en su propia configuración: instrucciones, preguntas, objetivo y formato del nombre. No se agregan reglas especiales dentro del sistema.
- Pregunta qué servicio necesita el cliente, el equipo, la falla, la zona y el mes deseado.
- Modo mixto: el agente perfila y pasa la conversación al asesor para el precio y la confirmación. No inventa precios.

## 2. Nombre automático según categoría y frecuencia
- El asesor (o el agente) captura la **Categoría** (por ejemplo «Mantenimiento») y la **Frecuencia** (Mensual, Trimestral, Semestral o Anual).
- Walix arma el nombre así: **Categoría + frecuencia en meses + mes y año del servicio**.
  - Mantenimiento + Semestral en noviembre → **«Mantenimiento 6M Nov 2026»**
  - Anual → «12M», Trimestral → «3M», Mensual → «1M», sin frecuencia → solo «Cambio de filtro Nov 2026»
- El mes es el del servicio programado; si no hay fecha, se usa el mes en que se crea la oportunidad.
- El nombre se recalcula si cambian la categoría, la frecuencia o el mes, **salvo que el asesor lo haya editado a mano**. En ese caso se respeta su nombre.
- En la ficha de la oportunidad aparecen los campos Categoría y Frecuencia junto al nombre, que se puede editar.
- Las oportunidades que ya existen no se renombran.

## Detalles técnicos
- La oportunidad ya guarda la categoría del producto y la frecuencia del servicio en meses, además del último nombre que se llenó automáticamente. Se agrega una opción de configuración por tenant, «formato de nombre de la oportunidad», que viene apagada para todos y solo se enciende en Refrigeración; no hay un tenant escrito en el código. Con esa opción encendida, una regla en la base de datos genera el nombre `<categoría> <N>M <Mes abreviado es-MX> <año>`. Solo sobrescribe el nombre si sigue igual al último que se llenó automáticamente, así se preservan las ediciones del asesor.
- El selector de Categoría y Frecuencia se muestra en la edición rápida que ya existe para las oportunidades.
- Las instrucciones y el objetivo del agente se actualizan solo en los datos de este tenant, y el agente llena la categoría y la frecuencia al perfilar.
- Pruebas: Mantenimiento + Semestral en noviembre de 2026 genera «Mantenimiento 6M Nov 2026», y después de una edición manual el nombre ya no cambia. Además se probará en el simulador de WhatsApp.
