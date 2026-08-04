ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_start_date date NOT NULL DEFAULT date '2026-08-01';
UPDATE public.tenants SET billing_start_date = date '2026-08-01';