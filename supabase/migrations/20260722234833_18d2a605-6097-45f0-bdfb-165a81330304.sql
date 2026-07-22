
-- 1) Tenants: metas y umbrales
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS monthly_goal_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_goal_by_type jsonb NOT NULL DEFAULT '{"venta":0,"servicio":0,"refaccion":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS count_business_days boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS profit_thresholds jsonb NOT NULL DEFAULT '{"green":20,"yellow":10,"orange":0}'::jsonb;

-- 2) Expense categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fijo','variable')),
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_categories_tenant ON public.expense_categories(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_select_tenant" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "cat_insert_admin" ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));
CREATE POLICY "cat_update_admin" ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));
CREATE POLICY "cat_delete_admin" ON public.expense_categories
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));

CREATE TRIGGER trg_expense_categories_updated
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('fijo','variable')),
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  incurred_at date NOT NULL DEFAULT CURRENT_DATE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  description text,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON public.expenses(tenant_id, incurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_deal ON public.expenses(deal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exp_select_tenant" ON public.expenses
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "exp_insert_tenant" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "exp_update_own_or_admin" ON public.expenses
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid())
    AND (owner_id = auth.uid()
         OR public.has_role(auth.uid(),'tenant_admin')
         OR public.has_role(auth.uid(),'tenant_owner')));
CREATE POLICY "exp_delete_own_or_admin" ON public.expenses
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid())
    AND (owner_id = auth.uid()
         OR public.has_role(auth.uid(),'tenant_admin')
         OR public.has_role(auth.uid(),'tenant_owner')));

CREATE TRIGGER trg_expenses_updated
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Seed categories on tenant creation
CREATE OR REPLACE FUNCTION public.seed_default_expense_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.expense_categories (tenant_id, name, kind, icon) VALUES
    (NEW.id, 'Renta de oficina', 'fijo', 'building'),
    (NEW.id, 'Telefonía e internet', 'fijo', 'phone'),
    (NEW.id, 'Nómina', 'fijo', 'users'),
    (NEW.id, 'Suscripciones y software', 'fijo', 'monitor'),
    (NEW.id, 'Servicios (luz, agua)', 'fijo', 'zap'),
    (NEW.id, 'Refacciones', 'variable', 'wrench'),
    (NEW.id, 'Viáticos', 'variable', 'car'),
    (NEW.id, 'Impresiones y papelería', 'variable', 'printer'),
    (NEW.id, 'Comisiones', 'variable', 'percent'),
    (NEW.id, 'Envíos y logística', 'variable', 'truck')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_expense_categories ON public.tenants;
CREATE TRIGGER trg_seed_expense_categories
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_expense_categories();

-- 5) Backfill existing tenants
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    INSERT INTO public.expense_categories (tenant_id, name, kind, icon)
    SELECT t.id, x.name, x.kind, x.icon FROM (VALUES
      ('Renta de oficina','fijo','building'),
      ('Telefonía e internet','fijo','phone'),
      ('Nómina','fijo','users'),
      ('Suscripciones y software','fijo','monitor'),
      ('Servicios (luz, agua)','fijo','zap'),
      ('Refacciones','variable','wrench'),
      ('Viáticos','variable','car'),
      ('Impresiones y papelería','variable','printer'),
      ('Comisiones','variable','percent'),
      ('Envíos y logística','variable','truck')
    ) AS x(name,kind,icon)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.expense_categories c WHERE c.tenant_id = t.id AND c.name = x.name
    );
  END LOOP;
END $$;
