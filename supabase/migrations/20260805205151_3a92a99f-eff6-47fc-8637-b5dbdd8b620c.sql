ALTER TABLE public.recurrence_occurrences
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_quoted numeric,
  ADD COLUMN IF NOT EXISTS price_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.recurrence_occurrences SET due_date = date_trunc('month', due_date)::date WHERE due_date <> date_trunc('month', due_date)::date;

DELETE FROM public.recurrence_occurrences a
USING public.recurrence_occurrences b
WHERE a.subscription_id = b.subscription_id
  AND a.due_date = b.due_date
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS recurrence_occurrences_sub_due_uniq
  ON public.recurrence_occurrences (subscription_id, due_date);

CREATE INDEX IF NOT EXISTS recurrence_occurrences_tenant_due_status_idx
  ON public.recurrence_occurrences (tenant_id, due_date, status);