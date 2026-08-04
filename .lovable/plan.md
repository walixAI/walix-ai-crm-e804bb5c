# Nueva estructura de planes y créditos

## 1. Se elimina el plan gratuito
El plan **Starter ($0)** desaparece del catálogo. En su lugar:
- **Prueba gratis de 14 días** sobre el plan PyME (ya existe la lógica de trial con `trial_ends_at`).
- Las empresas hoy en `starter` se migran a `pyme` con trial activo (no se les cobra automáticamente).

## 2. Precios recomendados

| Plan | Precio mensual | Anual (−20%) | Usuarios | Pipelines | Créditos WhatsApp / mes | Créditos IA / mes |
|---|---|---|---|---|---|---|
| **PyME** | $899 MXN | $719 | 5 | 2 | 100 | 1,000 |
| **Growth** | $1,499 MXN | $1,199 | 15 | 5 | 150 | 4,000 |
| **Enterprise** | **$2,500 MXN** | $2,000 | Ilimitados | Ilimitados | **250** | **12,000** |

Refrigeración González y Rodríguez queda en **Enterprise, $2,500/mes, 250 créditos WhatsApp y 12,000 créditos IA**.

### Qué es un crédito
- **Crédito de WhatsApp** = 1 conversación iniciada por la empresa (plantilla fuera de la ventana de 24 h). Las respuestas dentro de la ventana de 24 h no consumen crédito.
- **Crédito de IA** = 1 acción del Copiloto o agente (sugerencia, resumen, propuesta, scoring, comando por WhatsApp). Costo interno estimado ~$0.02–0.05 MXN por crédito: 12,000 créditos ≈ $250–600 MXN de costo real sobre $2,500 de precio, margen sano.

### Plan de consumo de IA para Enterprise (recomendado)
- 12,000 créditos incluidos al mes (≈ 400/día), suficiente para 15+ usuarios activos con Copiloto, resúmenes diarios y agentes automáticos.
- Modelos premium habilitados (razonamiento y propuestas largas).
- Al 80 % de consumo: aviso en la app. Al 100 %: se degrada a modelo económico en lugar de bloquear, y se ofrece comprar un paquete adicional.
- Los créditos no usados **no** se acumulan (evita bolsas grandes impredecibles).

## 3. Paquetes adicionales sugeridos

**WhatsApp (créditos de conversación)**

| Paquete | Créditos | Precio | Unitario |
|---|---|---|---|
| WA 100 | 100 | $390 MXN | $3.90 |
| WA 500 | 500 | $1,750 MXN | $3.50 |
| WA 1,000 | 1,000 | $3,200 MXN | $3.20 |

**IA (créditos de consumo)**

| Paquete | Créditos | Precio | Unitario |
|---|---|---|---|
| IA 5K | 5,000 | $349 MXN | $0.07 |
| IA 15K | 15,000 | $899 MXN | $0.06 |
| IA 50K | 50,000 | $2,490 MXN | $0.05 |

Los paquetes no expiran durante el ciclo de facturación en curso + 1 mes.

## 4. Cambios técnicos

**Base de datos**
- `plan_limits`: quitar la fila `starter`; actualizar `monthly_price` de `pyme` (899), `growth` (1499), `enterprise` (2500); añadir columnas `annual_price`, `whatsapp_credits`, `ai_credits`.
- Nueva tabla `credit_packs` (catálogo: tipo whatsapp/ai, créditos, precio) con lectura para usuarios autenticados.
- Nueva tabla `tenant_credit_balances` (empresa, periodo, créditos incluidos, consumidos y comprados) con aislamiento por empresa y GRANTs.
- Actualizar el tenant de Refrigeración a `enterprise` con MRR 2500.

**Frontend**
- `src/lib/plans.ts`: quitar Starter y centralizar precios, créditos y paquetes.
- `src/pages/Pricing.tsx` y `Landing.tsx`: 3 planes en vez de 4, con filas “Créditos WhatsApp/mes” y “Créditos IA/mes”, y CTA de prueba de 14 días.
- `BillingTab.tsx`: mostrar plan, precio, consumo de créditos del mes y compra de paquetes adicionales.
- `OrgPlanCard.tsx` y `OrgTenantsTable.tsx`: mismas etiquetas y precios.
- El consumo se alimenta de `ai_usage_log` y del log de envíos de WhatsApp ya existentes.