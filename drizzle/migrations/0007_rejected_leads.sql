CREATE TABLE public.rejected_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reason text NOT NULL,
  rule_kind text,
  rule_value text,
  name text,
  phone text,
  email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  contact_id uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rejected_leads_tenant_idx ON public.rejected_leads(tenant_id, status, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.rejected_leads TO authenticated;
GRANT ALL ON public.rejected_leads TO service_role;
ALTER TABLE public.rejected_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant select rejected" ON public.rejected_leads FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update rejected" ON public.rejected_leads FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete rejected" ON public.rejected_leads FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));