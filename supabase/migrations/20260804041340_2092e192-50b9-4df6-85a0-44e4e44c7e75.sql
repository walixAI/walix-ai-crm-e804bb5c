CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('contacts','products','deals','activities')),
  file_name TEXT,
  file_size INTEGER,
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preview','importing','done','reverted')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own import batches"
ON public.import_batches
FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapped_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','imported','error','skipped')),
  error_message TEXT,
  target_table TEXT,
  target_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;

ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage import rows through batches"
ON public.import_rows
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.import_batches b
    WHERE b.id = import_rows.batch_id
      AND b.tenant_id = public.get_user_tenant(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.import_batches b
    WHERE b.id = import_rows.batch_id
      AND b.tenant_id = public.get_user_tenant(auth.uid())
  )
);

CREATE TABLE public.recurrence_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'periodic' CHECK (kind IN ('periodic','calendar')),
  period_months INTEGER,
  anticipation_days INTEGER NOT NULL DEFAULT 15,
  target_pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  target_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  substitution_rule JSONB NOT NULL DEFAULT '{"enabled":false}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurrence_definitions TO authenticated;
GRANT ALL ON public.recurrence_definitions TO service_role;

ALTER TABLE public.recurrence_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own recurrence definitions"
ON public.recurrence_definitions
FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TABLE public.recurrence_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recurrence_id UUID NOT NULL REFERENCES public.recurrence_definitions(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact','deal','equipment')),
  entity_id UUID NOT NULL,
  next_due_date DATE,
  last_executed_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurrence_subscriptions TO authenticated;
GRANT ALL ON public.recurrence_subscriptions TO service_role;

ALTER TABLE public.recurrence_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own recurrence subscriptions"
ON public.recurrence_subscriptions
FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TABLE public.recurrence_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recurrence_id UUID NOT NULL REFERENCES public.recurrence_definitions(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.recurrence_subscriptions(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  generated_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  generated_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','notified','completed','skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurrence_occurrences TO authenticated;
GRANT ALL ON public.recurrence_occurrences TO service_role;

ALTER TABLE public.recurrence_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own recurrence occurrences"
ON public.recurrence_occurrences
FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER import_batches_updated_at BEFORE UPDATE ON public.import_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER recurrence_definitions_updated_at BEFORE UPDATE ON public.recurrence_definitions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER recurrence_subscriptions_updated_at BEFORE UPDATE ON public.recurrence_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER recurrence_occurrences_updated_at BEFORE UPDATE ON public.recurrence_occurrences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();