# Diagnóstico de por qué no avanzan las oportunidades

## El problema de análisis

Hoy cada seguimiento captura **canal** (llamada/WhatsApp/email + dirección) y **tipificación de resultado** (Contacto efectivo, No contestó...). Eso responde "¿qué hicimos?" pero no "¿por qué está detenido?".

Hay tres situaciones distintas que hoy no se distinguen y que necesitan datos diferentes:

| Situación | Qué dijo el lead | Qué necesitamos capturar |
|---|---|---|
| **Está vivo pero detenido** | "Estoy evaluando otros proveedores", "espero presupuesto" | Un **bloqueo** temporal, con fecha esperada de resolución |
| **Dijo que no** | "Está caro", "no me sirve", "ya compré con otro" | Un **motivo de cierre perdido**, terminal |
| **Dejó de contestar** | Nada — silencio | Detección automática + **cuál era el último bloqueo vigente** |

El valor analítico está en cruzar las tres: el lead que se silencia rara vez explica por qué, pero su último bloqueo declarado sí lo revela.

## Modelo propuesto

### Capa 1 — Bloqueo (lead vivo)
Catálogo configurable por tenant, ejemplos por defecto:
- Evaluando otros proveedores
- Esperando aprobación interna / de su jefe
- Esperando presupuesto o liberación de recursos
- Revisando la propuesta técnica
- Pidió que lo contactemos después
- Precio en revisión / pidió descuento

Cada bloqueo se registra en el seguimiento junto con una **fecha esperada de resolución**. Es un estado vigente: se mantiene hasta que otro seguimiento lo cambie o lo resuelva.

### Capa 2 — Motivo de pérdida (lead terminal)
Catálogo configurable por tenant, ejemplos por defecto:
- Precio alto
- No cubre su necesidad
- Compró con la competencia
- Sin presupuesto
- Ya no responde
- Ya no es el momento

Se captura al marcar la oportunidad como perdida, o al registrar un seguimiento cuyo resultado sea de desinterés explícito.

### Capa 3 — Silencio inferido
Regla automática configurable (por defecto **10 días** sin respuesta del lead):
- La oportunidad se marca con la señal **"Sin respuesta"** (no se cierra automáticamente, sólo se marca).
- Se conserva el **último bloqueo vigente** al momento del silencio, como "última señal conocida".
- Aparece en Mi Día como pendiente de decisión: reactivar o cerrar como perdida.

## Qué se puede responder con esto

1. ¿Cuántas oportunidades están detenidas y por qué motivo? (conteo y monto por bloqueo)
2. ¿Cuánto tiempo promedio dura cada tipo de bloqueo, y cuál nunca se resuelve?
3. ¿Qué % de los que declararon "precio en revisión" terminaron perdidos?
4. **Cruce clave**: último bloqueo declarado → motivo final de pérdida. Revela la causa real detrás de los silencios.
5. ¿Qué vendedor acumula más oportunidades detenidas por el mismo bloqueo?
6. ¿En qué etapa del embudo aparecen más bloqueos de precio?

## Alcance de implementación

### Base de datos
- Tabla `deal_blockers` (catálogo por tenant): `label`, `description`, `default_resolution_days`, `position`, `is_active`.
- Tabla `deal_loss_reasons` (catálogo por tenant): `label`, `description`, `position`, `is_active`. Sustituye el texto libre que hoy se guarda en `deals.lost_reason`.
- Columnas nuevas en `deals`: `current_blocker_id`, `blocker_set_at`, `blocker_expected_at`, `loss_reason_id`, `last_inbound_at`, `no_response_since`.
- Semillas con los catálogos recomendados de arriba.
- Job diario que marca `no_response_since` cuando pasan N días sin actividad entrante, respetando el umbral configurado por tenant.

### Registro de seguimiento
En `LogFollowUpDialog.tsx`, después de la tipificación, aparece un bloque contextual:
- Si el resultado indica que sigue vivo → selector **"¿Qué está esperando el lead?"** + fecha esperada de resolución.
- Si el resultado indica desinterés → selector **"Motivo de pérdida"** + comentario.
- Si ya había un bloqueo vigente, se muestra y se puede marcar como resuelto.

Todo se guarda en la actividad (histórico) y actualiza el estado vigente de la oportunidad.

### Visualización
- **Tarjeta de oportunidad y `DealDrawer`**: chip del bloqueo vigente con antigüedad ("Evaluando otros proveedores · 12 días").
- **Señal "Sin respuesta"** con el último bloqueo conocido.
- **Perfil del contacto**: el bloqueo o motivo aparece en cada entrada del feed de actividad.

### Reportes
Nueva sección **"Por qué no avanzan"** en Reportes:
- Distribución de bloqueos vigentes (conteo, monto, antigüedad promedio).
- Distribución de motivos de pérdida del periodo.
- Matriz de cruce último bloqueo × motivo de pérdida.
- Desglose por vendedor y por etapa.

### Ajustes
En Ajustes → Seguimiento, dos secciones nuevas junto a las tipificaciones: administración de **Bloqueos** y de **Motivos de pérdida**, más el umbral de días de silencio.

## Notas técnicas
- Los catálogos son por tenant, con RLS y grants como el resto de tablas.
- `deals.lost_reason` (texto) se conserva y se migra a `loss_reason_id` cuando hay coincidencia; el texto queda como respaldo.
- El bloqueo **no mueve etapas** — es informativo, coherente con la decisión ya tomada sobre las tipificaciones.
- El histórico vive en `activities.metadata`; el estado vigente vive en `deals` para poder filtrar y ordenar rápido.

## Criterios de aceptación
1. Al registrar un seguimiento se puede declarar qué está esperando el lead, con fecha esperada.
2. Al perder una oportunidad se elige un motivo del catálogo del tenant.
3. Una oportunidad sin respuesta del lead por N días se marca sola, conservando su último bloqueo.
4. El reporte muestra el cruce entre último bloqueo y motivo de pérdida.
5. El tenant administra ambos catálogos y el umbral de silencio desde Ajustes.