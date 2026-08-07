ALTER TABLE public.monthly_goals
  ADD COLUMN IF NOT EXISTS metric text NOT NULL DEFAULT 'amount';

ALTER TABLE public.monthly_goals
  DROP CONSTRAINT IF EXISTS monthly_goals_metric_check;

ALTER TABLE public.monthly_goals
  ADD CONSTRAINT monthly_goals_metric_check CHECK (metric IN ('amount','count'));

DROP INDEX IF EXISTS public.ux_monthly_goals_dim;

CREATE UNIQUE INDEX ux_monthly_goals_dim
  ON public.monthly_goals (
    tenant_id, period_year, period_month, metric, dimension,
    COALESCE(dimension_value_text, ''::text),
    COALESCE((dimension_value_uuid)::text, ''::text)
  );