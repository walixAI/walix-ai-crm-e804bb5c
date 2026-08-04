# Nueva estructura de planes y créditos

## 1. Se elimina el plan gratuito
El plan **Starter ($0)** desaparece del catálogo. En su lugar:
- **Prueba gratis de 14 días** sobre el plan PyME (ya existe la lógica de trial con `trial_ends_at`).
- Las empresas hoy en `starter` se migran a `pyme` con trial activo (no se les cobra automáticamente).

## 2. Precios recomendados

| Plan | Precio mensual | Anual (−20%) | Usuarios | Pipelines | Créditos WhatsApp / mes | Créditos IA / mes | Modelo de IA |
|---|---|---|---|---|---|---|---|
| **PyME** | $899 MXN | $719 | 5 | 2 | 100 | 1,000 | Gemini Flash Lite |
| **Growth** | $1,499 MXN | $1,199 | 15 | 5 | 150 | 4,000 | Gemini Flash |
| **Enterprise** | **$2,500 MXN** | $2,000 | Ilimitados | Ilimitados | **250** | **10,000** | Gemini Flash + Gemini Pro para tareas complejas |

Refrigeración González y Rodríguez queda en **Enterprise, $2,500/mes, 250 créditos WhatsApp y 10,000 créditos IA** con Gemini como motor.

### Qué es un crédito
- **Crédito de WhatsApp** = 1 conversación iniciada por la empresa (plantilla fuera de la ventana de 24 h). Las respuestas dentro de la ventana de 24 h no consumen crédito.
- **Crédito de IA** = 1 acción del Copiloto o agente (sugerencia, resumen, propuesta, scoring, comando por WhatsApp). Una acción típica consume ~3,000 tokens de entrada y ~800 de salida.

### Costo real con Gemini (base del precio)
Precios de referencia de Gemini Flash: ~$0.30 USD por millón de tokens de entrada y ~$2.50 USD por millón de salida.

- Acción típica ≈ (3,000 × 0.30 + 800 × 2.50) / 1,000,000 ≈ **$0.0029 USD ≈ $0.055 MXN por crédito**.
- Gemini Flash Lite cuesta ~3–4 veces menos (≈ $0.015 MXN por crédito) → se usa en PyME.
- Gemini Pro cuesta ~8–10 veces más (≈ $0.45 MXN por crédito) → en Enterprise se cobra **1 acción Pro = 8 créditos**.

Costo mensual estimado de IA incluida: PyME ≈ $15 MXN, Growth ≈ $220 MXN, Enterprise ≈ $550 MXN. Margen superior al 75 % en los tres planes.

### Plan de consumo de IA para Enterprise (recomendado)
- 10,000 créditos incluidos al mes (≈ 330/día) para 15+ usuarios con Copiloto, resúmenes diarios y agentes automáticos.
- Modelo base Gemini Flash; Gemini Pro habilitado para propuestas y análisis largos con factor 8x.
- Al 80 % de consumo: aviso en la app. Al 100 %: degradación automática a Flash Lite en lugar de bloquear, con opción de comprar paquete adicional.
- Los créditos no usados **no** se acumulan.

## 3. Modelo de IA por empresa (lo controlas tú)

**Solo el dueño de Walix (rol de plataforma) asigna el modelo de IA de cada empresa.** Ni el dueño de la organización ni el administrador de la empresa pueden cambiarlo.

- **Arranque: todas las empresas usan el Gemini más barato** (`google/gemini-3.1-flash-lite`), incluida Refrigeración González y Rodríguez.
- Desde el panel de plataforma, en la tabla de empresas, cada fila tiene un selector **“Modelo de IA”** con los motores disponibles; el cambio aplica de inmediato y queda en el log de auditoría (quién, cuándo, de qué modelo a cuál).

| Motor | Modelos ofrecidos | Factor de consumo de créditos |
|---|---|---|
| **Gemini** (default) | Flash Lite (default), Flash, Pro | 1x / 2x / 8x |
| **OpenAI** | GPT mini, GPT completo | 2x / 6x |
| **Claude** | Modelo estándar de Anthropic | 4x (requiere habilitación previa del proveedor) |

- La empresa ve en Ajustes → IA **solo el nombre comercial** de su motor actual (“Walix IA · Estándar / Avanzado / Premium”) y un botón **“Solicitar cambio de modelo”** que envía la petición a Walix Support; la aprobación la haces tú desde el panel.
- El factor de consumo se aplica al descontar créditos: un motor más caro no cambia el precio del plan, solo consume la bolsa más rápido.

## 4. Paquetes adicionales sugeridos

**WhatsApp (créditos de conversación)**

| Paquete | Créditos | Precio | Unitario |
|---|---|---|---|
| WA 100 | 100 | $390 MXN | $3.90 |
| WA 500 | 500 | $1,750 MXN | $3.50 |
| WA 1,000 | 1,000 | $3,200 MXN | $3.20 |

**IA (créditos de consumo, tarifados sobre Gemini)**

| Paquete | Créditos | Precio | Unitario | Costo real aprox. |
|---|---|---|---|---|
| IA 2K | 2,000 | $349 MXN | $0.175 | $110 MXN |
| IA 5K | 5,000 | $749 MXN | $0.150 | $275 MXN |
| IA 15K | 15,000 | $1,890 MXN | $0.126 | $825 MXN |

Los paquetes no expiran durante el ciclo de facturación en curso + 1 mes.

## 5. Cambios técnicos

**Base de datos**
- `plan_limits`: quitar la fila `starter`; actualizar `monthly_price` de `pyme` (899), `growth` (1499), `enterprise` (2500); añadir columnas `annual_price`, `whatsapp_credits`, `ai_credits`, `allowed_ai_vendors`.
- `tenants`: nuevas columnas `ai_vendor` (gemini | openai | anthropic, default `gemini`) y `ai_model` (default `google/gemini-3.1-flash-lite`). Solo escribibles por roles de plataforma (`is_platform`); la empresa únicamente puede leerlas.
- Nueva tabla `ai_model_catalog` (motor, id de modelo, nombre comercial, factor de créditos, activo) para poblar el selector.
- Nueva tabla `ai_model_change_requests` (empresa, motor solicitado, motivo, estado, revisor) con RLS por empresa y resolución solo por plataforma.
- Nueva tabla `credit_packs` (catálogo: tipo whatsapp/ai, créditos, precio) con lectura para usuarios autenticados.
- Nueva tabla `tenant_credit_balances` (empresa, periodo, créditos incluidos, consumidos y comprados) con aislamiento por empresa y GRANTs.
- Actualizar el tenant de Refrigeración a `enterprise` con MRR 2500.

**Frontend**
- `src/lib/plans.ts`: quitar Starter y centralizar precios, créditos, paquetes y factores de consumo por motor.
- `src/pages/Pricing.tsx` y `Landing.tsx`: 3 planes en vez de 4, con filas “Créditos WhatsApp/mes” y “Créditos IA/mes”, y CTA de prueba de 14 días.
- `BillingTab.tsx`: mostrar plan, precio, consumo de créditos del mes y compra de paquetes adicionales.
- Ajustes → IA: tarjeta con el motor actual y el botón “Solicitar cambio de modelo”; panel de plataforma para aprobar solicitudes.
- Panel de plataforma (tabla de empresas): columna “Modelo de IA” con selector editable solo para el dueño de Walix, más la bandeja de solicitudes pendientes.
- `OrgPlanCard.tsx` y `OrgTenantsTable.tsx`: mismas etiquetas y precios.

**Backend**
- Las funciones de IA (`walix-copilot`, agentes) leen `ai_vendor`/`ai_model` de la empresa en vez de tener el modelo fijo, y registran los créditos consumidos en `ai_usage_log` aplicando el factor del motor.
- El consumo se alimenta de `ai_usage_log` y del log de envíos de WhatsApp ya existentes.