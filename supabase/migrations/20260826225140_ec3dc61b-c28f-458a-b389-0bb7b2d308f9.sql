ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS feature_recurrences boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_expenses boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_deal_types boolean NOT NULL DEFAULT false;

CREATE TABLE public.deal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_types TO authenticated;
GRANT ALL ON public.deal_types TO service_role;

ALTER TABLE public.deal_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage own deal types"
ON public.deal_types
FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TRIGGER update_deal_types_updated_at
BEFORE UPDATE ON public.deal_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.seed_default_deal_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deal_types (tenant_id, key, label, position)
  VALUES (NEW.id, 'venta', 'Venta', 0)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_deal_types ON public.tenants;
CREATE TRIGGER trg_seed_default_deal_types
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_default_deal_types();