CREATE TABLE public.tenant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  module_id text NOT NULL,
  pricing_model text NOT NULL,
  monthly_price_mxn numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  activated_by uuid,
  activated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_id)
);

CREATE INDEX idx_tenant_modules_tenant ON public.tenant_modules(tenant_id);

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select tenant_modules"
  ON public.tenant_modules FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid()));

CREATE POLICY "tenant admin insert tenant_modules"
  ON public.tenant_modules FOR INSERT
  WITH CHECK (
    is_platform(auth.uid())
    OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
    )
  );

CREATE POLICY "tenant admin update tenant_modules"
  ON public.tenant_modules FOR UPDATE
  USING (
    is_platform(auth.uid())
    OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
    )
  )
  WITH CHECK (
    is_platform(auth.uid())
    OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
    )
  );

CREATE POLICY "tenant admin delete tenant_modules"
  ON public.tenant_modules FOR DELETE
  USING (
    is_platform(auth.uid())
    OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
    )
  );

CREATE TRIGGER trg_tenant_modules_updated_at
  BEFORE UPDATE ON public.tenant_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();