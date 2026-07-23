
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  day_of_month INT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_expenses_tenant ON public.recurring_expenses(tenant_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec_exp_select" ON public.recurring_expenses FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "rec_exp_insert" ON public.recurring_expenses FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "rec_exp_update" ON public.recurring_expenses FOR UPDATE USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "rec_exp_delete" ON public.recurring_expenses FOR DELETE USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.expense_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percent_of_deal','fixed_per_deal','percent_of_cost')),
  value NUMERIC NOT NULL CHECK (value >= 0),
  deal_type_filter TEXT CHECK (deal_type_filter IN ('venta','servicio') OR deal_type_filter IS NULL),
  auto_confirm BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_rules_tenant ON public.expense_rules(tenant_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_rules TO authenticated;
GRANT ALL ON public.expense_rules TO service_role;
ALTER TABLE public.expense_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp_rules_select" ON public.expense_rules FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "exp_rules_insert" ON public.expense_rules FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "exp_rules_update" ON public.expense_rules FOR UPDATE USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "exp_rules_delete" ON public.expense_rules FOR DELETE USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE TRIGGER trg_expense_rules_updated_at BEFORE UPDATE ON public.expense_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft','confirmed')),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','recurring','rule','whatsapp')),
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES public.expense_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON public.expenses(recurring_id, incurred_at);

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(14,2) DEFAULT 0 CHECK (cost_amount >= 0);

CREATE OR REPLACE FUNCTION public.generate_deal_expense_drafts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_amount NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_won IS DISTINCT FROM true THEN RETURN NEW; END IF;
  ELSE
    IF NOT (NEW.is_won = true AND COALESCE(OLD.is_won, false) = false) THEN RETURN NEW; END IF;
  END IF;

  FOR r IN
    SELECT * FROM public.expense_rules
    WHERE tenant_id = NEW.tenant_id AND is_active = true
      AND (deal_type_filter IS NULL OR deal_type_filter = NEW.deal_type)
  LOOP
    v_amount := CASE r.rule_type
      WHEN 'percent_of_deal' THEN ROUND(COALESCE(NEW.amount,0) * r.value / 100.0, 2)
      WHEN 'fixed_per_deal'  THEN r.value
      WHEN 'percent_of_cost' THEN ROUND(COALESCE(NEW.cost_amount,0) * r.value / 100.0, 2)
    END;
    IF v_amount IS NULL OR v_amount <= 0 THEN CONTINUE; END IF;
    INSERT INTO public.expenses (
      tenant_id, owner_id, kind, category_id, amount, currency,
      incurred_at, deal_id, description, status, source, rule_id
    ) VALUES (
      NEW.tenant_id, NEW.owner_id, 'variable', r.category_id, v_amount, 'MXN',
      CURRENT_DATE, NEW.id, r.name || ' (auto por deal ganado)',
      CASE WHEN r.auto_confirm THEN 'confirmed' ELSE 'draft' END, 'rule', r.id
    );
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_deals_expense_drafts ON public.deals;
CREATE TRIGGER trg_deals_expense_drafts
  AFTER INSERT OR UPDATE OF is_won ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.generate_deal_expense_drafts();

CREATE OR REPLACE FUNCTION public.generate_recurring_expenses()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; v_date DATE; v_count INT := 0;
  v_month_start DATE := date_trunc('month', CURRENT_DATE)::date;
  v_month_end DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
BEGIN
  FOR r IN SELECT * FROM public.recurring_expenses WHERE is_active = true LOOP
    v_date := v_month_start + (LEAST(r.day_of_month, 28) - 1);
    IF EXISTS (
      SELECT 1 FROM public.expenses
      WHERE recurring_id = r.id
        AND incurred_at BETWEEN v_month_start AND v_month_end
    ) THEN CONTINUE; END IF;
    INSERT INTO public.expenses (
      tenant_id, kind, category_id, amount, currency,
      incurred_at, description, status, source, recurring_id
    ) VALUES (
      r.tenant_id, 'fijo', r.category_id, r.amount, 'MXN',
      v_date, COALESCE(r.description, 'Gasto mensual recurrente'),
      'confirmed', 'recurring', r.id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;
