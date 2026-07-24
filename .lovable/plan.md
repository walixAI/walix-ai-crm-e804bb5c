# Metas granulares por agente + Run Rate y rentabilidad individual

Extendemos el modelo actual de `tenant_monthly_goals` (hoy solo global) para soportar metas por **tipo de deal**, **pipeline** y **categoría/producto propio**, con reparto por porcentaje entre los vendedores elegidos. Encima construimos vistas de Run Rate y rentabilidad por usuario, tablero de equipo y ranking.

## 1. Modelo de datos (backend)

**Nuevo catálogo de productos/servicios propios del tenant**
- `product_categories`: `id`, `tenant_id`, `name`, `is_active`, `position`.
- Opcional en `deals`: `product_category_id` (nullable, para poder atribuir un deal a una categoría cuando aplique).

**Metas por dimensión (reemplaza gradualmente el uso plano de `tenant_monthly_goals`)**
- `monthly_goals`
  - `tenant_id`, `period_year`, `period_month`, `amount`, `currency`
  - `dimension`: `global` | `deal_type` | `pipeline` | `product_category`
  - `dimension_value` (texto para `deal_type`, uuid para pipeline/category, null para global)
  - Único por (tenant, año, mes, dimension, dimension_value)
  - Misma protección de meses pasados que hoy (`tenant_monthly_goals_no_past`).
- `monthly_goal_assignments`
  - `goal_id` → `monthly_goals.id`
  - `user_id`
  - `share_percent` (0–100) y `amount` calculado
  - Suma de `share_percent` por `goal_id` debe = 100 (validación en trigger).
- `monthly_goal_history` (auditoría de cambios del mes en curso, igual que hoy).

**Ejecución (para Run Rate / rentabilidad individual)**
- Vista `deals_won_by_user_month`: suma `amount` y `cost_amount` de deals ganados por `owner_id`, mes, `deal_type`, `pipeline_id`, `product_category_id`.
- Vista `expenses_by_owner_month`: gastos con `owner_id` + gastos ligados a deals ganados del vendedor (`expenses.deal_id`).
- Función `get_user_run_rate(tenant, user, year, month)` y `get_user_profitability(...)` para reutilizar en Mi Día y tablero.

## 2. UI de configuración de metas (Admin)

Pantalla **Configuración → Metas** rediseñada:

```text
┌───────────────────────────────────────────────────────────┐
│ Meta de Julio 2026                              [+ Meta]  │
├───────────────────────────────────────────────────────────┤
│ Global .......................... $480,000  [editar]     │
│ Por tipo de deal                                          │
│   • Venta ....................... $300,000               │
│   • Mantenimiento ............... $120,000               │
│   • Refacciones ................. $ 60,000               │
│ Por pipeline                                              │
│   • Ventas Sub-Zero ............. $250,000               │
│ Por categoría/producto                                    │
│   • Refrigerador 36" ............ $180,000               │
└───────────────────────────────────────────────────────────┘
```

Al crear/editar una meta:
1. Elegir **dimensión** (global / deal_type / pipeline / product_category) y el valor.
2. Capturar **monto total**.
3. **Reparto entre agentes**: seleccionar vendedores → por defecto `share_percent` sugerido con **ponderado histórico** (ventas ganadas de los últimos 3 meses en esa dimensión). El admin puede ajustar a mano cada %; la UI valida que sume 100 y muestra el monto por vendedor en vivo.
4. Guardado bloqueado en meses pasados (misma regla actual).

Cátalogo de **Productos/Categorías** se administra en la misma sección (CRUD sencillo).

## 3. Run Rate y rentabilidad por vendedor

**Mi Día (vendedor)**
- La tarjeta actual de Run Rate ahora muestra dos filas: **Mi Run Rate** (contra la suma de sus asignaciones del mes) y **Run Rate del equipo** (colapsado).
- Nueva tarjeta compacta **Mi rentabilidad**: margen = (mis ventas ganadas − gastos atribuidos a mis deals) / mis ventas ganadas. Mismos semáforos que la actual (verde/amarillo/rojo).

**Tablero de equipo (admin) — nueva ruta `/equipo`**
- Tabla por vendedor con: meta asignada, ganado, run rate %, pronóstico fin de mes, gastos atribuidos, margen %, # deals abiertos, # deals ganados.
- Filtro por dimensión (todas / tipo / pipeline / categoría) para ver el desglose.
- Ranking ordenable por avance de meta y por margen.

## 4. Copiloto

Nuevas primitivas nativas para el catálogo de capacidades (ya que existe la infraestructura de `copilot_capabilities`):
- `get_user_run_rate` (lectura, propia por defecto; admin puede scope=tenant).
- `get_user_profitability` (lectura, misma regla).
- `set_monthly_goal_assignment` (ejecución, admin, confirmación obligatoria) para ajustar el % de un vendedor por voz/chat.

## 5. Migración de lo existente

- `tenant_monthly_goals` actual queda como `dimension='global'` en `monthly_goals` (copiamos los registros y dejamos el trigger de historial).
- El código de `GoalsTab`, `RunRateCard`, `ProfitabilityCard` y `MiDia` se actualiza para leer del nuevo modelo, con fallback si un tenant aún no configuró desgloses.

## Detalles técnicos

- **SQL**: nuevas tablas con `GRANT` a `authenticated`/`service_role` y RLS por `tenant_id` + `has_role` (`tenant_admin`/`tenant_owner` para escribir metas; vendedor puede leer sus asignaciones).
- **Validación de %**: trigger `AFTER INSERT/UPDATE/DELETE` en `monthly_goal_assignments` que recalcula la suma por `goal_id` y lanza excepción si ≠ 100 al confirmar (permite estados intermedios usando una bandera `is_draft` en `monthly_goals`).
- **Ponderado histórico**: función `suggest_goal_split(goal_id, user_ids[])` que devuelve `share_percent` sugerido usando ventas ganadas de los 3 meses previos en esa dimensión; si no hay historia, partes iguales.
- **Rentabilidad por vendedor**: usa `expenses.deal_id` (ya existe) + `expenses.owner_id` para gastos no ligados a deal.
- **Meses pasados**: reutilizamos `tenant_monthly_goals_no_past` adaptado al nuevo `monthly_goals`; asignaciones heredan la misma regla.
- **Frontend**: nuevos componentes `GoalBuilderDialog`, `GoalSplitEditor`, `TeamDashboard`, más `useUserRunRate`/`useUserProfitability` hooks. Sin cambios en el diseño global.

¿Avanzo con esto o quieres ajustar algún punto (por ejemplo, empezar solo con `deal_type` y dejar `product_category` para una fase 2)?