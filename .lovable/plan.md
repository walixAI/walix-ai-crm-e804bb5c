# Walix Learning Loop — Plan

Implements the feedback cycle so Walix.ai learns from each tenant's results: capture outcomes of acted-on suggestions, distill weekly patterns via a new agent, inject those patterns into every AI system prompt, and surface them as a "Insights del negocio" widget in Reports.

## 1. Database (migration)

New tables (RLS, tenant-scoped):

- **`ai_outcome_feedback`**
  `id, tenant_id, suggestion_id (nullable FK ai_proactive_suggestions), action_taken text, entity_type text, entity_id uuid, outcome text, outcome_value numeric default 0, days_to_outcome int, context_at_action jsonb default '{}', created_at`.
  RLS: tenant select; insert by tenant members; no update/delete (immutable log).
  Indexes: `(tenant_id, created_at desc)`, `(tenant_id, outcome)`, `(suggestion_id)`.

- **`ai_tenant_patterns`**
  `id, tenant_id, pattern_type text, pattern_data jsonb, confidence_score float default 0, sample_size int default 0, updated_at`.
  Unique `(tenant_id, pattern_type)` so the Aprendiz upserts.
  RLS: tenant select; insert/update only via service-role (no client policies for write).

DB triggers (security definer, search_path=public) to auto-capture outcomes — only when an `ai_proactive_suggestions` row was `acted_on` within the last 7 days for the same `entity_id`:

- `trg_deals_outcome` AFTER UPDATE on `deals`:
  - `is_won` flips true → `outcome='deal_closed'`, `outcome_value=NEW.amount`.
  - `is_lost` flips true → `outcome='deal_lost'`.
  - `stage_id` changes (and not won/lost) → `outcome='deal_advanced'`.
- `trg_messages_outcome` AFTER INSERT on `messages` where `direction='inbound'`: if there was an outbound message in the last 24h on the same conversation linked to a recent acted-on suggestion → `outcome='contact_responded'`.
- `no_response` is computed lazily by the Aprendiz agent (scan outbound msgs older than 72h with no reply on suggestions linked to the contact).

Helper SQL function `public.get_tenant_patterns(_tenant_id)` returning the latest pattern rows (used by edge functions via service-role; readable also under tenant select RLS).

Enable Realtime on `ai_outcome_feedback` so the Reports widget can refresh.

## 2. New agent type: `aprendiz`

- Add `'aprendiz'` to `AgentType` (TS) and seed one row per tenant in `seed_default_ai_agents()` (cron `0 3 * * 0`, model `google/gemini-2.5-flash`, allowed_tools includes a new `update_tenant_pattern`).
- New backfill migration: `INSERT ... SELECT id FROM tenants` so existing tenants also get an Aprendiz.

## 3. Edge function changes

- **`supabase/functions/_shared/ai-tools.ts`**
  - Add tool `update_tenant_pattern(pattern_type, pattern_data, confidence_score, sample_size)` → upsert into `ai_tenant_patterns`.
  - Add helper `getTenantPatterns(sb, tenantId)` and `formatPattern(p)` (returns one human line in Spanish per pattern type).
  - In the prompt builder used by `runAgenticLoop` (and exported `appendLearnedPatterns(systemPrompt, patterns)`), append a `PATRONES APRENDIDOS DE ESTE NEGOCIO:` block when patterns exist.
- **`supabase/functions/ai-copilot/index.ts`** — call `appendLearnedPatterns` at the end of `buildSystemPrompt`.
- **`supabase/functions/ai-agent-runner/index.ts`**
  - Same prompt injection (already uses runAgenticLoop, but we centralize so no extra wiring needed).
  - New branch for `agent_type='aprendiz'`: pulls `ai_outcome_feedback` for the past 7 days, requires ≥20 rows, computes preliminary aggregates (best_followup_day, peak_response_hours from `contact_responded` events, avg_close_days from `deal_closed`, top_objections from `deals.lost_comment` + recent notes, winning_sequences from suggestion → outcome paths, top seller per stage from `deal_stage_history`). Passes raw aggregates to the LLM and lets it call `update_tenant_pattern` for each pattern with a confidence score. Also runs the lazy `no_response` capture.

## 4. Frontend — Reports widget

- New component `src/components/reports/BusinessInsightsCard.tsx`:
  - Queries `ai_tenant_patterns` for current tenant + count of `ai_outcome_feedback` rows.
  - If sample size <20 deals analyzed → "Recopilando datos..." with a `Progress` bar (`min(count/20, 1)`).
  - Otherwise renders a list of insight rows (icon + Spanish sentence per pattern_type) using existing `InsightCard`.
  - Footer badge: `Basado en N deals analizados · Confianza: Alta/Media/Baja` (Alta ≥0.8, Media ≥0.5).
- Wire it into `src/pages/app/Reports.tsx` right above `KpiHeroRow`.
- Pattern formatters live in `src/lib/reports/patternFormatters.ts` (shared label/icon map).

## 5. Services / types

- `src/services/learning.ts` with `listTenantPatterns()`, `countOutcomeFeedback()`.
- Extend `src/services/agents.ts` `AgentType` union with `'aprendiz'` and an icon entry in `AgentCard.tsx`.

## 6. Files to add/edit

- New: migration SQL, `BusinessInsightsCard.tsx`, `patternFormatters.ts`, `services/learning.ts`.
- Edited: `_shared/ai-tools.ts`, `ai-copilot/index.ts`, `ai-agent-runner/index.ts`, `services/agents.ts`, `AgentCard.tsx`, `Reports.tsx`.
- Backfill insert (via insert tool, not migration): one Aprendiz row per existing tenant.

## Risks / notes

- Triggers must be SECURITY DEFINER with `set search_path=public` and only fire when `ai_proactive_suggestions` proves recent intent — keeps the feedback signal clean.
- Pattern injection adds tokens to every prompt; cap at top 6 patterns by confidence.
- All writes to `ai_tenant_patterns` go through service-role inside the Aprendiz to avoid spoofing from clients.
