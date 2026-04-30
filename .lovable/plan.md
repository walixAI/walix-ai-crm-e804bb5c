
# Plan: eliminar datos mock y conectar todo a Supabase

## Diagnóstico — qué está mockeado hoy

Se detectaron **5 archivos mock** (`src/mock/*.ts`) usados aún por **30 archivos** de la app. La gravedad varía por módulo:

### Severidad ALTA — el módulo entero corre con datos falsos

**1. Reports (`/reports`)** — todo el módulo lee de `src/mock/reports.ts`:
- `KpiHeroRow` → `kpiCards` (revenue, pipeline, close rate, ciclo)
- `SalesFunnelChart` → `funnelStages`
- `SellerPerformanceTable` + `SellerDetailDrawer` → `sellerPerformance`, `sellerDeals`
- `LeadSourcesPie` → `leadSources`, `sourceInsight`
- `LostDealsChart` → `lostReasons`, `lostTotalAmount`, `lostInsight`
- `StageConversionsSection` → `stageConversions`, `conversionInsight`
- `TeamActivityHeatmap` → `heatmap`, `heatmapDays`
- `ReportsHeader` / `SellerMultiSelect` → lista `sellers` hardcodeada (María López, Carlos Ruiz, etc.)

### Severidad MEDIA — vendedores ficticios filtran datos reales

**2. Lista de vendedores hardcoded** (`sellers` en `src/mock/contacts.ts` — 4 personas inventadas) usada en:
- `lib/queries/contacts.ts` → asigna nombre/iniciales por **hash del owner_id** ⇒ los nombres mostrados en Contactos no son los reales del equipo
- `lib/queries/pipeline.ts` y `lib/queries/whatsapp.ts` → mismo patrón
- `PipelineFilters`, `ContactFormDialog`, `ChatHeader`, `Whatsapp.tsx` → dropdowns de "asignar a"
- `ContactHeader`, `ContactStatsBar`, `SummaryTab` (detalle 360°) → metadata de tags/estados hardcoded

### Severidad BAJA — strings/listas estáticas

**3. Helpers y catálogos estáticos en `src/mock/contacts.ts`:**
- `allTags` (catálogo de tags) — debería venir de `contact_tags`
- `statusBadgeClass`, `getTagMeta` (mapeos de color) — son UI puro, pueden quedarse pero moverse fuera de `/mock`
- `relativeTime` — utilidad de formato, mover a `src/lib/utils.ts`
- `ContactStats` interface — mover a `src/types/`

**4. AI prompts (`src/mock/ai.ts` → `QUICK_AI_PROMPTS`)** usado en `TopBar` y `AiDrawer` — son sugerencias estáticas (UX), no datos. **No urgente**, pero conviene moverlo a `src/lib/constants/`.

**5. `src/mock/index.ts`** exporta `tenant`, `kpis`, `recentConversations`, etc. Solo `tenant` se usa (en `Automations.tsx` para mostrar el nombre) — reemplazar por `useTenant()`.

**6. `src/mock/dashboard.ts`** — ya **no se importa** en ningún lado ⇒ borrar.

---

## Plan de actualización

### Fase 1 — Catálogo real de vendedores (desbloquea Reports y Contactos)

Crear hook `useTenantUsers()` que devuelva los miembros activos del tenant desde `profiles` (filtro por `tenant_id` + `is_active`), con `id`, `full_name`, `email`, iniciales calculadas y color asignado de forma estable.

Reemplazar **todas** las importaciones de `sellers` (mock) por este hook en:
- `lib/queries/contacts.ts`, `pipeline.ts`, `whatsapp.ts` (resolver `owner_id → nombre real`)
- `PipelineFilters`, `ContactFormDialog`, `ChatHeader`, `SellerMultiSelect`, `ReportsHeader`, `SellerPerformanceTable`, `SellerDetailDrawer`

### Fase 2 — Catálogo de tags real

Hook `useContactTags()` leyendo `contact_tags` (ya existe la tabla con `family`, `icon`). Reemplazar `allTags` y `getTagMeta` del mock en `ContactFormDialog`, `ContactHeader`.

### Fase 3 — Reports conectado a Supabase

Crear `src/lib/queries/reports.ts` con hooks que agreguen datos reales según el rango `filters.period`:

| Hook | Tablas | Agregación |
|---|---|---|
| `useReportsKpis()` | `deals` | revenue cerrado (is_won), pipeline activo (no won/lost), tasa de cierre, ciclo promedio (created_at → updated_at en won) |
| `useReportsFunnel()` | `deals` + `pipeline_stages` | conteo y suma por stage |
| `useReportsSellers()` | `deals` agrupados por `owner_id` join `profiles` | revenue, deals ganados, ciclo, tasa |
| `useReportsLeadSources()` | `deals.source` | distribución |
| `useReportsLostReasons()` | `deals` (is_lost=true) | agrupado por `lost_reason` |
| `useReportsStageConversions()` | `deal_stage_history` | conversiones stage→stage |
| `useReportsHeatmap()` | `activities` | conteo por día/hora y owner |

Reemplazar todas las importaciones de `@/mock/reports` en los 9 componentes de `src/components/reports/`. El export PDF/CSV (`lib/reports/exportCsv.ts`, `exportPdf.ts`) recibe los datos por props ⇒ se actualiza al pasar datos reales desde la página.

Insights estáticos (`lostInsight`, `sourceInsight`, `conversionInsight`) → generarlos con la edge function `dashboard-ai-widgets` (ya existe) o moverlos a strings dinámicos calculados.

### Fase 4 — Limpieza final

1. Reemplazar `tenant.name` (mock) en `Automations.tsx` por hook `useTenant()` desde `tenants`.
2. Mover utilidades puras fuera de `/mock`:
   - `relativeTime` → `src/lib/utils.ts`
   - `statusBadgeClass`, `getTagMeta` → `src/lib/contacts/badges.ts`
   - `QUICK_AI_PROMPTS` → `src/lib/constants/aiPrompts.ts`
   - Tipos (`LeadStatus`, `Source`, `ContactStats`, `SellerId`) → `src/types/`
3. Borrar archivos: `src/mock/contacts.ts`, `src/mock/reports.ts`, `src/mock/dashboard.ts`, `src/mock/ai.ts`, `src/mock/index.ts`.
4. Borrar carpeta `src/mock/`.
5. Verificación: `rg "@/mock"` debe retornar **0 resultados**.

---

## Detalles técnicos relevantes

- **Performance Reports**: agregaciones costosas (funnel, heatmap, conversions) conviene exponerlas como **RPC SECURITY DEFINER** (`get_reports_funnel(_tenant uuid, _from timestamptz, _to timestamptz)`) para evitar bajar miles de filas al cliente. Alternativa: mantener en cliente con `staleTime: 5min` si los volúmenes son bajos (<5k deals).
- **Resolver `owner_id → profile`**: hoy no hay JOIN porque no existen FK declaradas. Usar `supabase.from('deals').select('*, profiles!deals_owner_id_fkey(full_name)')` requiere FK. Alternativa segura: traer `profiles` por separado en `useTenantUsers()` y mapear en cliente (es lo que ya hace `ownerFromId` pero con datos falsos).
- **Sellers color**: generar color estable por hash del `user_id` (ya existe la lógica), pero usando el nombre real.
- **Filtros de período**: `filters.period` ya existe en `useReportFilters` ⇒ pasar como `from`/`to` a cada hook.
- **RLS**: todas las tablas involucradas (`deals`, `activities`, `profiles`, `contact_tags`, `deal_stage_history`) ya tienen RLS por `tenant_id` ⇒ no se requieren migraciones.

## Entregables

- 1 hook nuevo: `useTenantUsers()`
- 1 hook nuevo: `useContactTags()`
- 1 archivo nuevo: `src/lib/queries/reports.ts` (~7 hooks)
- (Opcional) 1 migración con funciones RPC de agregación para Reports
- ~20 archivos editados (componentes + queries que importan de `@/mock`)
- 5 archivos borrados (todo `src/mock/`)
- Utilidades movidas a `src/lib/` y `src/types/`

## Lo que NO cambia

- Esquema de BD (no requiere migraciones, salvo RPCs opcionales de Fase 3)
- RLS y políticas de seguridad
- UI/UX visible (mismos componentes, solo cambia la fuente de datos)
- Edge functions existentes
