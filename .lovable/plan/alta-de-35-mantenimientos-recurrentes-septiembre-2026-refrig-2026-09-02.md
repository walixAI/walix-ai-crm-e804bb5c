# Alta de 35 mantenimientos recurrentes (Septiembre 2026) — Refrigeración G&R

Carga de los 35 registros del archivo `Septiembre_Erick.xlsx` como oportunidades de mantenimiento con fecha 01/09/2026 y recurrencia semestral.

## Decisiones ya confirmadas

- Monto por oportunidad: $2,000 MXN
- Etapa inicial: Intento de Contacto
- Responsable: Norma Heredia
- Contactos faltantes: se crean nuevos

## Qué haré exactamente

1. **Contactos**
   - Busco cada fila por teléfono (últimos 10 dígitos) en el tenant Refrigeración. Hoy 36 de 45 teléfonos ya existen.
   - A los existentes les completo dirección y equipo (columna 3) si están vacíos, y agrego el segundo teléfono como teléfono alterno.
   - Los que no existan se crean como contacto de tipo cliente, con nombre, dirección, teléfono principal, teléfono alterno, equipo/modelo del refrigerador y propietario Norma.

2. **Oportunidades (35)**
   - Una por fila: título `Mantenimiento semestral — <equipo>`, contacto asociado, monto $2,000, categoría de producto **Mantenimientos**, etapa **Intento de Contacto**, cierre estimado **01/09/2026**, responsable Norma.
   - Se marcan como recurrentes semestrales para que el motor de recurrencias las reconozca.

3. **Recurrencia semestral**
   - Creo la suscripción de recurrencia por contacto ligada a la definición **Mantenimiento semestral** (cada 6 meses), con la ocurrencia de **01/09/2026** vinculada a su oportunidad y `next_due_date` en 01/03/2027.
   - Así, cuando Norma pase la oportunidad a Ganado, Walix agenda solo las siguientes citas y, 5 días antes del mes de servicio, genera la oportunidad + tarea + notificación.

4. **Tarea de seguimiento**
   - Una tarea por oportunidad para Norma, con vencimiento 01/09/2026: “Contactar y agendar mantenimiento de septiembre”.

5. **Verificación**
   - Consulto conteos finales: contactos creados vs. actualizados, 35 oportunidades en Intento de Contacto con cierre 01/09/2026, 35 suscripciones semestrales activas y 35 tareas, y te entrego el resumen con la lista de contactos nuevos.

## Notas técnicas

- Todo se hace con inserciones/actualizaciones de datos (tool de SQL de datos), sin cambios de esquema ni de código de la app.
- Teléfonos se normalizan al formato `+52##########` que ya usa el tenant.
- Filas sin apellido (“Aurora”, “Irene”, “Pola”, “Ariela”, “Marcos”, “Ovadia”, “Kalb”, “Charfen”, “Rubio”, “Cerisola”, “Askenazi”) se cargan con el nombre tal cual viene en el archivo.
- Fila “Marcos”: el teléfono viene como “Esposa 5521078667”; se guarda el número y la nota “Esposa” en el contacto.
- Idempotencia: si ya existe una oportunidad de mantenimiento con cierre 01/09/2026 para ese contacto, no se duplica.
