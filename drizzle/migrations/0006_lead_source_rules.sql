CREATE TABLE public.lead_source_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  leads_count integer NOT NULL DEFAULT 0,
  last_lead_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_source_rules_kind_chk CHECK (kind IN ('web_domain','meta_form','meta_ad_account','google_ads_account')),
  CONSTRAINT lead_source_rules_unique UNIQUE (kind, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_source_rules TO authenticated;
GRANT ALL ON public.lead_source_rules TO service_role;
ALTER TABLE public.lead_source_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsr tenant read" ON public.lead_source_rules FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid()));
CREATE POLICY "lsr tenant insert" ON public.lead_source_rules FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "lsr tenant update" ON public.lead_source_rules FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid())) WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "lsr tenant delete" ON public.lead_source_rules FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()));
CREATE TRIGGER lsr_updated_at BEFORE UPDATE ON public.lead_source_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();