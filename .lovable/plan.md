# Agente de Refrigeración y nombre de la oportunidad

Solo para el tenant **Refrigeración González y Rodríguez**. No cambia nada en SCALA, SXP ni otros tenants.

## 1. Agentes (ya existen, se configuran)
El tenant ya tiene dos agentes, uno por embudo; se configuran en lugar de crear uno nuevo:
- **Agente de Servicio y Mantenimiento**: atiende fallas, mantenimientos 6M/12M, cambio de filtro y refacciones. Pregunta el tipo de equipo, la marca, la falla, la colonia y el horario preferido, y luego agenda la visita.
- **Agente de Ventas Nuevas**: atiende cotizaciones de equipo nuevo. Pregunta el uso (casa o negocio), la capacidad y el presupuesto.
- Modo **mixto**: responde y perfila solo, y pasa la conversación al asesor cuando hay que cotizar un precio o confirmar una visita. No inventa precios porque todavía no hay catálogo.
- Tono cordial y breve, en español de México.

## 2. Nombre de la oportunidad
- Se agrega un campo **«Nombre de la oportunidad»**.
- Se llena solo con el servicio y el equipo que dio el cliente, por ejemplo: «Mantenimiento 6M – Refrigerador Whirlpool».
- El asesor puede cambiarlo cuando quiera desde la edición rápida que ya existe. Si el asesor lo cambia, el agente ya no lo vuelve a sobrescribir.
- Las oportunidades viejas se quedan como están.

## Detalles técnicos
- Actualizar en `sales_agents` las instrucciones, el objetivo, el modo y las preguntas de perfilamiento de los 2 agentes del tenant, solo con datos (sin cambios en el código del cerebro compartido).
- Agregar a `contact_custom_fields` de este tenant los campos de perfilamiento: equipo, marca, falla y zona. El nombre se arma con el trigger de nombres que ya existe, que respeta las ediciones del asesor.
- Probar con el simulador `/wa-sim` una conversación de mantenimiento y confirmar que el nombre generado aparece en la oportunidad.
