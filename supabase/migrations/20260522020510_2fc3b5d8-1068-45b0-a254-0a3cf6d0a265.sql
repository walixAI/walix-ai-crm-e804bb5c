-- Hacer whatsapp_user_access independiente de profiles/miembros
ALTER TABLE public.whatsapp_user_access
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.whatsapp_user_access
  ADD COLUMN IF NOT EXISTS display_name text;

-- Quitar la unicidad por user_id (no aplica si pueden existir filas sin user_id)
ALTER TABLE public.whatsapp_user_access
  DROP CONSTRAINT IF EXISTS whatsapp_user_access_tenant_id_user_id_key;
