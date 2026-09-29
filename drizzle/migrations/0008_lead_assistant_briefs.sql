CREATE TABLE public.lead_assistant_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  basis_at timestamptz,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_assistant_briefs_tenant_idx ON public.lead_assistant_briefs(tenant_id);
GRANT SELECT ON public.lead_assistant_briefs TO authenticated;
GRANT ALL ON public.lead_assistant_briefs TO service_role;
ALTER TABLE public.lead_assistant_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant select lead briefs" ON public.lead_assistant_briefs FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));