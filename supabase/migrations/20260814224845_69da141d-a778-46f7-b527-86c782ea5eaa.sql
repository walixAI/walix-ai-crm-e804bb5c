ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bulk_edit_delete_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bulk_edit_entities text[] NOT NULL DEFAULT ARRAY['contacts','deals','tasks','activities']::text[];