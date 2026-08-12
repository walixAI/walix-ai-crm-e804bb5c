# Cierre de la semana 3–7 de agosto 2026 — Refrigeración G&R

Cargar los 10 servicios de la guía de trabajo (SEM 03-07) al tenant, hacerlos avanzar por todas las etapas hasta Ganado/Perdido y registrar los gastos de la semana.

## Lo que trae el archivo

| Cliente | Servicio | Importe | Fecha |
|---|---|---|---|
| Sra. Gabriela Tornell | Ref. G.E.D. Mantenimiento | $1,500 | 03/08 |
| Sra. Azar | S.Z. Mantenimiento | $2,000 | 03/08 |
| Sra. Castro | Samsung Mantenimiento | $1,500 | 06/08 |
| Sra. Estrella Cohen | S.Z. Mantenimiento y filtro | $4,500 | 06/08 |
| Sra. Rocío Salomón | Ref. Maytag Mantenimiento | $1,000 | 03/08 |
| Sra. Gabriela Tornell | Ref. G.E.D. Filtro y regulador | $5,500 | 06/08 |
| Sra. Teresa Machado | Ref. Samsung no hielos | $0 | 03/08 |
| Sra. Sonia Kobaj | Samsung Regulador | $3,800 | 07/08 |
| Dr. Ariel | Ref. S.Z.D. no enfría | (sin importe) | 05/08 |
| Sra. Janice Jaris | Ref. S.Z. Carga de gas y mantenimiento | $4,000 | 07/08 |

Suma de importes = $19,800, igual al TOTAL SEMANA del archivo.

## Cotejo con lo que ya existe en el tenant

- **Ya existen:** Azar, Castro, Estrella Cohen, Rocío Salomón, Janice Jaris, Dr. Ariel.
- **Sonia Kobaj** existe como **Sonia Kojab** (mismo teléfono 5532000665) — se usa ese contacto.
- **Teresa Machado**: no existe con ese nombre; el teléfono 5555703614 y la dirección Reforma #2570-29 corresponden a **Guadalupe de Castillo**. Se registra el servicio en ese contacto y se anota "Teresa Machado" en las notas.
- **Gabriela Tornell**: no existe. Se crea el contacto (tel. 5554011700, Cerrada la Presa #60 casa A4, San Jerónimo Lídice, modelo G.E.D.).
- **Dr. Ariel** está duplicado 3 veces; se usa el registro completo (con teléfono y dirección) y se dejan los otros dos como están (limpieza de duplicados aparte, si la quieres).
- Ya hay oportunidades de agosto abiertas para Castro, Cohen, Azar, Salomón, Jaris y Ariel. Se **reutilizan** esas (ajustando el importe al del archivo) en lugar de duplicar; solo se crean oportunidades nuevas donde no hay una que corresponda.

## Reglas de cierre

- **Ganado (Cobrado):** importe > $0 → 8 oportunidades. Se marca como ganada, con importe pagado y fecha de cierre = fecha del archivo.
- **Perdido:** Teresa Machado ($0) y Dr. Ariel (sin importe) → etapa Perdido con motivo "Sin venta / no se concretó".
- **Recorrido de etapas:** cada oportunidad queda registrada pasando por *Intento de contacto → Contactado → Agendado → En servicio → Cobrado* (o *Perdido*) en el historial de etapas, escalonado en horas del día del servicio, para que el embudo y las conversiones reflejen el avance real.
- Las oportunidades ganadas de mantenimiento disparan la recurrencia ya existente (se re-agenda el siguiente ciclo automáticamente).

## Gastos de la semana (fecha 07/08/2026)

| Concepto | Monto | Categoría | Tipo |
|---|---|---|---|
| Norma (nómina) | $2,400 | Nómina | Fijo |
| Refacciones | $3,090 | Refacciones | Variable |
| Gasolina | $500 | Viáticos | Variable |
| Celular | $300 | Telefonía e internet | Fijo |
| CRM (Walix) | $2,500 | Suscripciones y software | Fijo |
| **Total** | **$8,790** | | |

Se capturan como gastos confirmados (no borrador) para que aparezcan en el módulo de Gastos y en la rentabilidad del mes.

## Resultado esperado

- Ingreso de la semana en el CRM: **$19,800** — Gastos: **$8,790** — Utilidad: **$11,010**.
- 8 oportunidades ganadas y 2 perdidas, con historial completo de etapas.

## Detalle técnico

- Contactos: alta de Gabriela Tornell; actualización de teléfono/dirección/modelo donde el archivo trae dato más reciente.
- Oportunidades en el pipeline **Servicio y Mantenimiento** (Intento de Contacto → Contactado → Agendado → En servicio → Cobrado/Perdido), con `amount`, `amount_paid`, `payment_status`, `expected_close_date`, `service_type` y `equipment_brand`.
- Inserción de filas en `deal_stage_history` por cada transición.
- Gastos en `expenses` con estatus confirmado, `incurred_at = 2026-08-07` y `kind` fijo/variable según la tabla.