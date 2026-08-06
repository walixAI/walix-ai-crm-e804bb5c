CREATE TABLE public.bulk_edit_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  entity text NOT NULL CHECK (entity IN ('contacts','deals','tasks')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_ids uuid[] NOT NULL DEFAULT '{}',
  matched_count integer NOT NULL DEFAULT 0,
  applied_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','confirmed','applied','reverted','cancelled','expired')),
  confirm_code text NOT NULL,
  summary text,
  snapshot jsonb,
  applied_at timestamptz,
  reverted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.bulk_edit_operations TO authenticated;
GRANT ALL ON public.bulk_edit_operations TO service_role;

ALTER TABLE public.bulk_edit_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select bulk ops" ON public.bulk_edit_operations
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.is_platform(auth.uid()))
  );

CREATE POLICY "owner insert bulk ops" ON public.bulk_edit_operations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND requested_by = auth.uid()
    AND (public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.is_platform(auth.uid()))
  );

CREATE POLICY "owner update bulk ops" ON public.bulk_edit_operations
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.is_platform(auth.uid()))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id) OR public.is_platform(auth.uid()))
  );

CREATE INDEX idx_bulk_ops_tenant ON public.bulk_edit_operations (tenant_id, created_at DESC);

CREATE TRIGGER trg_bulk_ops_updated_at
  BEFORE UPDATE ON public.bulk_edit_operations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();