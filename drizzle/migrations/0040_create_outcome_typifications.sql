CREATE TABLE public.outcome_typifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  outcome_id UUID REFERENCES public.activity_outcomes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive','neutral','negative')),
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX outcome_typifications_tenant_idx ON public.outcome_typifications(tenant_id);
CREATE INDEX outcome_typifications_outcome_idx ON public.outcome_typifications(outcome_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outcome_typifications TO authenticated;
GRANT ALL ON public.outcome_typifications TO service_role;

ALTER TABLE public.outcome_typifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read typifications"
  ON public.outcome_typifications FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Non-reps insert typifications"
  ON public.outcome_typifications FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND NOT public.is_rep_only(auth.uid(), tenant_id));

CREATE POLICY "Non-reps update typifications"
  ON public.outcome_typifications FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND NOT public.is_rep_only(auth.uid(), tenant_id))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND NOT public.is_rep_only(auth.uid(), tenant_id));

CREATE POLICY "Non-reps delete typifications"
  ON public.outcome_typifications FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND NOT public.is_rep_only(auth.uid(), tenant_id));

CREATE TRIGGER outcome_typifications_updated_at
  BEFORE UPDATE ON public.outcome_typifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();