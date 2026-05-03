## Resumen
Aplicar mejoras de UI, estabilidad e IA. Mantener Gemini Flash como modelo.

## Cambios

### 1. Renombrar "Deal/Deals" → "Oportunidad/Oportunidades" (solo UI)
Reemplazo de textos visibles en español. No tocar claves de código, tipos, columnas DB, ni nombres de funciones/archivos.
- `src/components/pipeline/*` (DealCard, DealDrawer, DealsListView, KanbanBoard, KanbanColumn, NewDealDialog, PipelineHeader, PipelineFilters, ForecastKpis, BulkActionsBar, QuickActions, QuickTaskDialog, AiInsightsPanel, LostReasonDialog)
- `src/components/contacts/detail/DealsSidePanel.tsx`, `SummaryTab.tsx`, `AiFloatingPanel.tsx`
- `src/pages/app/Pipeline.tsx`, `Dashboard.tsx`, `Reports.tsx`, `ContactDetail.tsx`
- `src/components/walix/DashboardAiSection.tsx`, `CommandPalette.tsx`, `OnboardingTour.tsx`
- `src/components/reports/*` (textos visibles)
- `src/lib/constants/aiPrompts.ts` (prompts visibles del usuario)
- Prompts de Edge Functions IA: usar "oportunidad/oportunidades" en `system`/`user` prompts (`pipeline-ai`, `dashboard-ai-widgets`, `global-ai`, `contact-ai-suggest`, `whatsapp-ai`, `ai-inbox`)

### 2. Fix parpadeo al cambiar de pestaña
- `src/main.tsx` (o donde se crea el `QueryClient`): defaults `refetchOnWindowFocus: false`, `staleTime: 30_000`, `refetchOnReconnect: false`.
- `src/components/layout/AppLayout.tsx`: quitar `animate-fade-in` del `<main>` global (sigue disponible localmente en pantallas que la necesiten).

### 3. Saludo del Dashboard con nombre real
- `src/pages/app/Dashboard.tsx`: leer `profiles.full_name` (fallback a `user_metadata.full_name`, luego email). Reutilizar query existente de `profiles` si la hay.

### 4. Score determinístico de "Salud del Pipeline" (Dashboard)
Crear `src/lib/pipelineHealth.ts` con fórmula 0–100:
```text
activity      = 1 − stale_active / active            (peso 0.25)  stale = last_activity_at < hoy−10d
responsiveness= 1 − unread_open / total_open         (peso 0.25)
coverage      = min(1, weighted_forecast / target)   (peso 0.20)  target = mrr o configurable
winRate       = won_30d / (won_30d + lost_30d)       (peso 0.15)  neutro 0.5 si denom=0
velocity      = 1 − overdue_active / active          (peso 0.15)
score         = round(100 * Σ(componente * peso))
```
Mapeo: ≥80 excelente · 60–79 bueno · 40–59 atención · <40 crítico. Mostrar top‑3 componentes con mayor impacto negativo.
- `dashboard-ai-widgets` deja de generar `health.score` por IA; se calcula en cliente desde `useDashboardData` (o se añade la query mínima necesaria en `src/lib/queries/dashboard.ts`).
- `src/components/walix/DashboardAiSection.tsx`: render del score determinístico + breakdown.

### 5. Anti-alucinación en sugerencias de IA
- `supabase/functions/contact-ai-suggest/index.ts`:
  - System prompt: prohibir inventar nombres; usar solo nombres presentes en el contexto recibido.
  - Validación post‑LLM: extraer nombres mencionados; si alguno no coincide con `contact.name` o nombres pasados explícitamente, descartar la sugerencia y caer a heurística local.
- `src/lib/contacts/suggestions.ts`: filtro cliente equivalente como segunda barrera.

### 6. Modelo IA
Mantener `google/gemini-2.5-flash` en todas las Edge Functions. Sin cambios.

## Detalles técnicos
- No modificar `src/integrations/supabase/{client,types}.ts` ni `.env`.
- No cambiar nombres de columnas/tablas (`deals`, `deal_id`, etc.) — solo strings visibles.
- Tests: actualizar `src/lib/contacts/suggestions.test.ts` si cambia firma; añadir test unitario para `pipelineHealth.ts`.
- Sin migraciones de DB.

## Fuera de alcance
- Cambio a Claude / Anthropic.
- Refactor de IDs o esquema.
