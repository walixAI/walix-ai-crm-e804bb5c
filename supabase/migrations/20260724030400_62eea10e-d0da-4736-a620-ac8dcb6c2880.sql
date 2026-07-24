
-- =========================================================
-- 1. Product categories catalog
-- =========================================================
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read product_categories" ON public.product_categories FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "admins manage product_categories" ON public.product_categories FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));
CREATE TRIGGER product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS product_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_product_category ON public.deals(product_category_id);

-- =========================================================
-- 2. Monthly goals (multi-dimension)
-- =========================================================
CREATE TABLE public.monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  dimension TEXT NOT NULL CHECK (dimension IN ('global','deal_type','pipeline','product_category')),
  dimension_value_text TEXT,
  dimension_value_uuid UUID,
  notes TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_monthly_goals_dim
  ON public.monthly_goals (tenant_id, period_year, period_month, dimension,
    COALESCE(dimension_value_text, ''), COALESCE(dimension_value_uuid::text, ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_goals TO authenticated;
GRANT ALL ON public.monthly_goals TO service_role;
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read monthly_goals" ON public.monthly_goals FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "admins manage monthly_goals" ON public.monthly_goals FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));
CREATE TRIGGER monthly_goals_updated_at BEFORE UPDATE ON public.monthly_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.monthly_goals_no_past()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_first date; current_first date;
BEGIN
  target_first := make_date(NEW.period_year, NEW.period_month, 1);
  current_first := date_trunc('month', CURRENT_DATE)::date;
  IF target_first < current_first THEN
    RAISE EXCEPTION 'No se pueden crear ni modificar metas de meses pasados (% < %)', target_first, current_first
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER monthly_goals_no_past BEFORE INSERT OR UPDATE ON public.monthly_goals FOR EACH ROW EXECUTE FUNCTION public.monthly_goals_no_past();

-- =========================================================
-- 3. Assignments per user
-- =========================================================
CREATE TABLE public.monthly_goal_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.monthly_goals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  share_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (share_percent >= 0 AND share_percent <= 100),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (goal_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_goal_assignments TO authenticated;
GRANT ALL ON public.monthly_goal_assignments TO service_role;
ALTER TABLE public.monthly_goal_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own assignments; admins read all" ON public.monthly_goal_assignments FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid())
    AND (user_id = auth.uid() OR public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));
CREATE POLICY "admins manage assignments" ON public.monthly_goal_assignments FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));
CREATE TRIGGER monthly_goal_assignments_updated_at BEFORE UPDATE ON public.monthly_goal_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_goal_assignments_sum()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_goal_id UUID; v_sum NUMERIC; v_is_draft BOOLEAN; v_has_any BOOLEAN;
BEGIN
  v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
  SELECT is_draft INTO v_is_draft FROM public.monthly_goals WHERE id = v_goal_id;
  IF v_is_draft THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(share_percent),0), COUNT(*) > 0 INTO v_sum, v_has_any
    FROM public.monthly_goal_assignments WHERE goal_id = v_goal_id;
  IF v_has_any AND ROUND(v_sum, 2) <> 100.00 THEN
    RAISE EXCEPTION 'La suma de porcentajes asignados debe ser 100%% (actual: %). Marca la meta como borrador para guardar parcialmente.', v_sum
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE CONSTRAINT TRIGGER monthly_goal_assignments_sum_check
  AFTER INSERT OR UPDATE OR DELETE ON public.monthly_goal_assignments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_goal_assignments_sum();

CREATE OR REPLACE FUNCTION public.recalc_assignment_amount()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount NUMERIC;
BEGIN
  SELECT amount INTO v_amount FROM public.monthly_goals WHERE id = NEW.goal_id;
  NEW.amount := ROUND(COALESCE(v_amount,0) * COALESCE(NEW.share_percent,0) / 100.0, 2);
  RETURN NEW;
END; $$;
CREATE TRIGGER recalc_assignment_amount_trg
  BEFORE INSERT OR UPDATE OF share_percent, goal_id ON public.monthly_goal_assignments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_assignment_amount();

-- =========================================================
-- 4. History log
-- =========================================================
CREATE TABLE public.monthly_goal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  goal_id UUID,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.monthly_goal_history TO authenticated;
GRANT ALL ON public.monthly_goal_history TO service_role;
ALTER TABLE public.monthly_goal_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read history" ON public.monthly_goal_history FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner')));
CREATE POLICY "system inserts history" ON public.monthly_goal_history FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_monthly_goal_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.monthly_goal_history (tenant_id, goal_id, action, after_data, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'goal_created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.monthly_goal_history (tenant_id, goal_id, action, before_data, after_data, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'goal_updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.monthly_goal_history (tenant_id, goal_id, action, before_data, changed_by)
    VALUES (OLD.tenant_id, OLD.id, 'goal_deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER monthly_goals_history AFTER INSERT OR UPDATE OR DELETE ON public.monthly_goals FOR EACH ROW EXECUTE FUNCTION public.log_monthly_goal_change();

CREATE OR REPLACE FUNCTION public.log_assignment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.monthly_goal_history (tenant_id, goal_id, action, before_data, after_data, changed_by)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id), COALESCE(NEW.goal_id, OLD.goal_id), 'assignment_changed',
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER monthly_goal_assignments_history AFTER INSERT OR UPDATE OR DELETE ON public.monthly_goal_assignments FOR EACH ROW EXECUTE FUNCTION public.log_assignment_change();

-- =========================================================
-- 5. Migrate existing tenant_monthly_goals → monthly_goals(dimension='global')
-- =========================================================
INSERT INTO public.monthly_goals (
  tenant_id, period_year, period_month, amount, currency, dimension, created_at, updated_at
)
SELECT
  t.tenant_id, t.period_year, t.period_month, COALESCE(t.monthly_goal_total,0),
  'MXN', 'global',
  COALESCE(t.created_at, now()), COALESCE(t.created_at, now())
FROM public.tenant_monthly_goals t
WHERE make_date(t.period_year, t.period_month, 1) >= date_trunc('month', CURRENT_DATE)::date
ON CONFLICT DO NOTHING;

-- =========================================================
-- 6. Helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.suggest_goal_split(
  _tenant_id UUID, _dimension TEXT, _dimension_value_text TEXT, _dimension_value_uuid UUID, _user_ids UUID[]
) RETURNS TABLE(user_id UUID, share_percent NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start DATE := (date_trunc('month', CURRENT_DATE) - interval '3 months')::date;
  v_end   DATE := date_trunc('month', CURRENT_DATE)::date;
  v_total NUMERIC;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_split(user_id UUID, wins NUMERIC) ON COMMIT DROP;
  DELETE FROM _tmp_split;
  INSERT INTO _tmp_split(user_id, wins)
  SELECT d.owner_id, COALESCE(SUM(d.amount),0)
  FROM public.deals d
  WHERE d.tenant_id = _tenant_id AND d.is_won = true AND d.owner_id = ANY(_user_ids)
    AND d.updated_at >= v_start AND d.updated_at < v_end
    AND (
      _dimension = 'global'
      OR (_dimension = 'deal_type' AND d.deal_type = _dimension_value_text)
      OR (_dimension = 'pipeline' AND d.pipeline_id = _dimension_value_uuid)
      OR (_dimension = 'product_category' AND d.product_category_id = _dimension_value_uuid)
    )
  GROUP BY d.owner_id;
  SELECT COALESCE(SUM(wins),0) INTO v_total FROM _tmp_split;
  IF v_total > 0 THEN
    RETURN QUERY SELECT u,
      ROUND(COALESCE((SELECT wins FROM _tmp_split t WHERE t.user_id = u),0) / v_total * 100.0, 2)
      FROM unnest(_user_ids) u;
  ELSE
    RETURN QUERY SELECT u, ROUND(100.0 / GREATEST(array_length(_user_ids,1),1), 2) FROM unnest(_user_ids) u;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_run_rate(_tenant_id UUID, _user_id UUID, _year INT, _month INT)
RETURNS TABLE(assigned_goal NUMERIC, won_amount NUMERIC, open_amount NUMERIC, run_rate_pct NUMERIC, forecast_pct NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start DATE := make_date(_year, _month, 1);
  v_end   DATE := (v_start + interval '1 month')::date;
  v_days_total INT := (v_end - v_start);
  v_day_of_month INT := LEAST(EXTRACT(DAY FROM CURRENT_DATE)::int, v_days_total);
  v_assigned NUMERIC; v_won NUMERIC; v_open NUMERIC;
BEGIN
  SELECT COALESCE(SUM(a.amount),0) INTO v_assigned
  FROM public.monthly_goal_assignments a
  JOIN public.monthly_goals g ON g.id = a.goal_id
  WHERE g.tenant_id = _tenant_id AND g.period_year = _year AND g.period_month = _month
    AND a.user_id = _user_id AND g.dimension = 'global';

  IF v_assigned = 0 THEN
    SELECT COALESCE(g.amount,0) / NULLIF(public.tenant_active_users(_tenant_id),0) INTO v_assigned
    FROM public.monthly_goals g
    WHERE g.tenant_id = _tenant_id AND g.period_year = _year AND g.period_month = _month AND g.dimension = 'global'
    LIMIT 1;
    v_assigned := COALESCE(v_assigned, 0);
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_won FROM public.deals
  WHERE tenant_id = _tenant_id AND owner_id = _user_id AND is_won = true
    AND updated_at >= v_start AND updated_at < v_end;

  SELECT COALESCE(SUM(amount),0) INTO v_open FROM public.deals
  WHERE tenant_id = _tenant_id AND owner_id = _user_id
    AND COALESCE(is_won,false) = false AND COALESCE(is_lost,false) = false;

  RETURN QUERY SELECT v_assigned, v_won, v_open,
    CASE WHEN v_assigned > 0 THEN ROUND(v_won / v_assigned * 100.0, 2) ELSE 0 END,
    CASE WHEN v_assigned > 0 AND v_day_of_month > 0
         THEN ROUND((v_won / v_day_of_month * v_days_total) / v_assigned * 100.0, 2)
         ELSE 0 END;
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_profitability(_tenant_id UUID, _user_id UUID, _year INT, _month INT)
RETURNS TABLE(revenue NUMERIC, expenses NUMERIC, margin_amount NUMERIC, margin_pct NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start DATE := make_date(_year, _month, 1);
  v_end   DATE := (v_start + interval '1 month')::date;
  v_rev NUMERIC := 0; v_exp NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_rev FROM public.deals
  WHERE tenant_id = _tenant_id AND owner_id = _user_id AND is_won = true
    AND updated_at >= v_start AND updated_at < v_end;
  SELECT COALESCE(SUM(e.amount),0) INTO v_exp
  FROM public.expenses e LEFT JOIN public.deals d ON d.id = e.deal_id
  WHERE e.tenant_id = _tenant_id AND e.status = 'confirmed'
    AND e.incurred_at >= v_start AND e.incurred_at < v_end
    AND (e.owner_id = _user_id OR d.owner_id = _user_id);
  RETURN QUERY SELECT v_rev, v_exp, v_rev - v_exp,
    CASE WHEN v_rev > 0 THEN ROUND((v_rev - v_exp) / v_rev * 100.0, 2) ELSE 0 END;
END; $$;
