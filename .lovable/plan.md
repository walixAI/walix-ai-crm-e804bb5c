
# Run Rate + Gastos y Rentabilidad

Dos funcionalidades nuevas, integradas en Mi Día, Pipeline e Inicio, configurables por Tenant.

---

## 1. Run Rate del mes

Indicador visual (%) que compara lo vendido hasta hoy vs. lo que "deberías llevar" a esta altura del mes, y proyecta el cierre.

### Cálculo
- `meta_mes` = meta mensual del tenant (o del vendedor si aplica).
- `dias_habiles_transcurridos` / `dias_habiles_totales` del mes.
- `meta_esperada_hoy = meta_mes * (dias_habiles_transcurridos / dias_habiles_totales)`
- `vendido_hoy` = suma de `deals.amount` con `is_won = true` y `updated_at` dentro del mes actual (filtrable por `deal_type`: venta, servicio, refacción/mantenimiento).
- `run_rate_pct = vendido_hoy / meta_esperada_hoy * 100`
- `proyeccion_cierre = vendido_hoy / dias_habiles_transcurridos * dias_habiles_totales`

### Semáforo
- Verde: ≥ 100%
- Amarillo: 70–99%
- Rojo: < 70%

### Dónde aparece
- **Mi Día**: nueva tarjeta grande arriba (`RunRateCard`) con % en semáforo, meta, vendido, proyección de cierre, y 2–3 recomendaciones (basadas en pendientes: "Cierra las N cotizaciones abiertas por $X para llegar a la meta").
- **Pipeline**: chip compacto en la fila de KPIs (junto a "Cierre este mes"), con hover que muestra el detalle.
- **Inicio (Dashboard)**: KPI card resumido con enlace a Mi Día.

### Configuración por Tenant
Nueva pestaña **Metas** en Settings:
- Meta mensual global (MXN).
- Metas por tipo: `venta`, `servicio`, `refaccion`.
- Toggle: "Contar solo días hábiles (L–V)" o todos los días.

---

## 2. Módulo de Gastos y Rentabilidad

Captura de gastos fijos y variables, con vínculo opcional a un deal.

### Datos
Nueva tabla `expenses`:
- `tenant_id`, `owner_id`
- `kind`: `fijo` | `variable`
- `category_id` → `expense_categories` (Telefonía, Renta, Refacciones, Viáticos, Impresiones… seedeadas y editables por el tenant)
- `amount`, `currency` (MXN default)
- `incurred_at` (fecha)
- `deal_id` (opcional, para variables)
- `description`, `receipt_url` (opcional)

Nueva tabla `expense_categories`: `tenant_id`, `name`, `kind`, `icon`, `is_active`.

RLS: sólo miembros del tenant; edición para admin/owner o dueño del gasto.

### Rentabilidad
`rentabilidad_pct = (ventas_mes - gastos_mes) / ventas_mes * 100`
Semáforo:
- Verde: ≥ 20%
- Amarillo: 10–19%
- Naranja: 0–9%
- Rojo: < 0%

### Dónde aparece
- **Inicio (Dashboard)**: KPI card "Rentabilidad del mes" con % coloreado, ventas y gastos.
- **Nueva página `/gastos`**: lista + filtros (mes, tipo, categoría, deal), botón "Nuevo gasto", totales por categoría, mini gráfico ventas vs gastos.
- Enlace en Sidebar (modo estándar) y acción rápida en Mi Día.

### Configuración por Tenant
Pestaña **Gastos** en Settings:
- CRUD de categorías (fijas y variables).
- Umbrales de semáforo de rentabilidad (opcional, con defaults).

---

## Detalles técnicos

- **Migración**: añadir a `tenants`: `monthly_goal_total`, `monthly_goal_by_type jsonb`, `count_business_days boolean`, `profit_thresholds jsonb`. Crear `expenses` y `expense_categories` con GRANTs + RLS + trigger `updated_at`. Seed de categorías al crear tenant.
- **Queries**: `src/lib/queries/runRate.ts` (meta, vendido, proyección, recomendaciones) y `src/lib/queries/expenses.ts` (CRUD + agregados mensuales).
- **UI nueva**:
  - `src/components/walix/RunRateCard.tsx` (jumbo para Mi Día)
  - `src/components/walix/RunRateChip.tsx` (compacto para Pipeline/Dashboard)
  - `src/components/walix/ProfitabilityCard.tsx`
  - `src/pages/app/Expenses.tsx` + `ExpenseFormDialog`, `ExpenseList`, `CategoryChip`
  - `src/components/settings/goals/GoalsTab.tsx`
  - `src/components/settings/expenses/ExpenseCategoriesTab.tsx`
- **Integración**: Mi Día muestra RunRateCard arriba, ProfitabilityCard debajo de los summary chips. Pipeline agrega el chip en `ForecastKpis`. Dashboard suma dos KpiCards. Sidebar añade "Gastos" y Settings dos pestañas nuevas.
- **Recomendaciones**: heurísticas del cliente (no IA en esta fase) basadas en cotizaciones pendientes y deals en negociación cuya suma cubra el gap para llegar a meta.

---

## Fuera de alcance en esta iteración
- Metas por vendedor individual (solo global por tenant).
- Reportes históricos de rentabilidad multi-mes (se agrega el mes actual).
- Adjuntar recibos con OCR (solo URL manual).

¿Apruebas y arranco?
