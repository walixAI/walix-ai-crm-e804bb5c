
## Gastos automáticos: plantillas + reglas por deal + captura rápida

Objetivo: que el gestor casi no capture gastos manualmente. Se implementan las 3 capas (A + B + C) con el flujo híbrido que usan los negocios ágiles: **fijos se auto-confirman, variables quedan como borrador de 1 clic**.

---

### Pros y contras de cada capa

**A) Fijos recurrentes**
- Pros: eliminas 80% de la captura repetitiva (renta, nómina, internet). Los montos son predecibles.
- Contras: si algo cambia (aumentó la luz) y nadie edita, quedan datos viejos. Se mitiga permitiendo editar el monto del mes actual sin tocar la plantilla.

**B) Variables por deal ganado**
- Pros: cada venta arrastra automáticamente su costo (comisión, refacciones, viáticos). La rentabilidad refleja realidad sin trabajo extra.
- Contras: las reglas pueden no cubrir 100% del caso real (una refacción especial costó más). Se mitiga con borrador editable antes de confirmar.

**C) Captura ultra-rápida**
- Pros: para lo imprevisto (gasolina extra, comida con cliente), 3 segundos desde WhatsApp o Mi Día.
- Contras: requiere disciplina mínima. El recordatorio semanal ayuda.

### Cómo lo hacen los negocios ágiles (recomendación)

**Híbrido con borradores para variables:**
- Fijos → auto-confirmados el día 1 del mes. Predecibles, casi no fallan.
- Variables por deal → generan **borrador** cuando el deal pasa a ganado. Aparecen en un panel "Por confirmar" en el DealDrawer y en Gastos. El gestor da 1 clic para aprobar o ajusta el monto.
- Manuales rápidos → botón flotante + comando WhatsApp.

Este patrón es el que usan herramientas tipo QuickBooks/Xero: nadie recuerda capturar, el sistema propone, el humano solo aprueba diferencias.

### Reglas por tipo de deal (tu duda sobre mantenimiento vs venta)

Cada categoría de gasto variable tendrá una **regla con filtro por tipo de deal**:

- **Mantenimiento/servicio** → plantilla fija sugerida (ej. Refacciones $800 + Viáticos $300 + Comisión 5%). Editable al confirmar.
- **Venta de refacción** → costo de compra en % (ej. 60% del precio de venta) + Envío $200.
- **Venta nueva** → Comisión vendedor % + costo del equipo (capturado al crear el deal en un nuevo campo opcional `cost_amount`).

Cada regla tiene: categoría, tipo de aplicación (`%_deal` | `monto_fijo` | `%_desde_costo`), valor, y filtro `deal_type` (venta/servicio/refaccion/todos). Todo editable por tenant en Configuración → Gastos → Reglas.

---

### Cambios en datos (migración)

- **Nueva tabla `recurring_expenses`**: `tenant_id`, `category_id`, `amount`, `day_of_month` (1-28), `description`, `is_active`, timestamps.
- **Nueva tabla `expense_rules`**: `tenant_id`, `category_id`, `name`, `rule_type` (`percent_of_deal` | `fixed_per_deal` | `percent_of_cost`), `value` (numeric), `deal_type_filter` (text nullable: null=todos), `auto_confirm` (bool, default false), `is_active`, timestamps.
- **`expenses`** gana columnas: `status` (`draft` | `confirmed`, default `confirmed`), `source` (`manual` | `recurring` | `rule` | `whatsapp`, default `manual`), `rule_id` (fk nullable), `recurring_id` (fk nullable). Los gastos actuales quedan como `confirmed` + `manual`.
- **`deals`** gana columna opcional `cost_amount` (numeric, para venta de equipo con costo directo).
- Todas con GRANTs, RLS igual que las existentes, y triggers de `updated_at`.

### Jobs y triggers

- **Cron mensual día 1 07:00**: función `generate_recurring_expenses()` recorre `recurring_expenses` activos por tenant y crea `expenses` con `source='recurring'`, `status='confirmed'`, `incurred_at` = día del mes definido, evitando duplicados por (tenant, recurring_id, mes).
- **Trigger en `deals`** al pasar a `is_won=true`: función `generate_deal_expense_drafts()` evalúa `expense_rules` activas cuyo `deal_type_filter` case, calcula monto y crea `expenses` con `source='rule'`, `status='draft'`, `deal_id` ligado.
- Solo cuentan gastos `status='confirmed'` en la rentabilidad; los borradores se muestran aparte como "pendientes de confirmar".

### UI

- **`src/pages/app/Expenses.tsx`**: nueva sección arriba "Por confirmar" (X borradores, botón "Confirmar todos" + lista con editar/aprobar/descartar). Toggle para incluir/excluir borradores en totales.
- **DealDrawer** (`src/components/pipeline/DealDrawer.tsx`): panel "Gastos de este deal" mostrando reales + borradores generados por reglas, con botón "Confirmar" inline. Al crear/editar deal, campo opcional "Costo del producto".
- **Configuración → Gastos** (`ExpenseCategoriesTab.tsx`): 3 sub-pestañas
  - Categorías (ya existe)
  - **Fijos mensuales** — CRUD de `recurring_expenses` con preview "el próximo mes se generarán $X"
  - **Reglas por venta** — CRUD de `expense_rules` con selector de tipo de deal y explicación en lenguaje natural ("Por cada servicio, agrega $800 de Refacciones")
- **Mi Día** (`MiDia.tsx`): botón flotante "+ Gasto rápido" (FAB abajo-derecha) que abre `ExpenseFormDialog`. Chip en RunRateCard si hay borradores pendientes.
- **Recordatorio semanal viernes**: si no hay gastos manuales en la semana, banner en Mi Día "¿Tuviste gastos esta semana? Regístralos en 1 clic".

### WhatsApp: comando "gasto"

- En `whatsapp-ai-command/index.ts`, nueva intención `create_expense`. El vendedor autorizado escribe `gasto 450 gasolina` o `gasto 1200 refacciones para deal Juan Pérez`. El bot parsea monto + categoría (fuzzy match con `expense_categories`) + deal opcional, crea el gasto y responde "✅ Registrado: $450 Gasolina (variable)".
- Categoría no encontrada → pide confirmar cuál usar con quick reply.

### Queries y hooks

- **`src/lib/queries/expenses.ts`** amplía: `useRecurringExpenses`, `useUpsertRecurring`, `useDeleteRecurring`, `useExpenseRules`, `useUpsertRule`, `useDeleteRule`, `useDraftExpenses`, `useConfirmExpense`, `useConfirmAllDrafts`.
- `useMonthProfitability` filtra por `status='confirmed'` y expone `pendingDrafts` count.

### Fuera de alcance esta iteración
- Aprobación multi-nivel (jefe aprueba gastos de vendedor).
- OCR de tickets fotográficos.
- Presupuesto por categoría con alertas.
- Split de un gasto entre varios deals.
- Recurrencias no mensuales (trimestral, anual).

---

¿Apruebas y arranco con la migración + UI + trigger + cron + comando WhatsApp?
