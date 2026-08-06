ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bulk_edit_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bulk_edit_allow_admins boolean NOT NULL DEFAULT false;