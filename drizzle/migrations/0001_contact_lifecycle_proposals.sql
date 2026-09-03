ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS status_proposed text,
  ADD COLUMN IF NOT EXISTS status_proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_proposed_reason text,
  ADD COLUMN IF NOT EXISTS status_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS status_set_manually_at timestamptz;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS lifecycle_grace_days integer NOT NULL DEFAULT 60;

CREATE INDEX IF NOT EXISTS contacts_status_proposed_idx
  ON public.contacts (tenant_id) WHERE status_proposed IS NOT NULL;
