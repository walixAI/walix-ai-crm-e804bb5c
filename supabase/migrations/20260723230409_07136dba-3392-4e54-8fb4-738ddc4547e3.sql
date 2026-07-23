
CREATE TABLE public.tenant_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_year int NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  monthly_goal_total numeric NOT NULL DEFAULT 0,
  monthly_goal_by_type jsonb NOT NULL DEFAULT '{"venta":0,"servicio":0,"refaccion":0}'::jsonb,
  count_business_days boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tmg_tenant_period ON public.tenant_monthly_goals (tenant_id, period_year DESC, period_month DESC, created_at DESC);

GRANT SELECT, INSERT ON public.tenant_monthly_goals TO authenticated;
GRANT ALL ON public.tenant_monthly_goals TO service_role;

ALTER TABLE public.tenant_monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_tenant_members" ON public.tenant_monthly_goals
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "goals_insert_admin" ON public.tenant_monthly_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.has_role(auth.uid(), 'tenant_owner')
      OR public.has_role(auth.uid(), 'tenant_admin')
      OR public.has_role(auth.uid(), 'org_owner')
    )
  );

-- Trigger: no permitir metas de meses ya cerrados
CREATE OR REPLACE FUNCTION public.tenant_monthly_goals_no_past()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_first date;
  current_first date;
BEGIN
  target_first := make_date(NEW.period_year, NEW.period_month, 1);
  current_first := date_trunc('month', CURRENT_DATE)::date;
  IF target_first < current_first THEN
    RAISE EXCEPTION 'No se pueden crear ni modificar metas de meses pasados (% <  %)', target_first, current_first
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tmg_no_past
  BEFORE INSERT ON public.tenant_monthly_goals
  FOR EACH ROW EXECUTE FUNCTION public.tenant_monthly_goals_no_past();
