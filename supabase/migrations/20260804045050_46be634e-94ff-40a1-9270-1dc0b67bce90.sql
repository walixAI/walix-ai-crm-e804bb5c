-- 1. Campos estándar nuevos en contactos
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone_alt TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS contacts_tenant_phone_idx ON public.contacts (tenant_id, phone);

-- 2. Catálogo de campos personalizados por tenant
CREATE TABLE IF NOT EXISTS public.contact_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  placeholder TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_in_list BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key),
  CONSTRAINT contact_custom_fields_type_chk CHECK (field_type IN ('text','number','date','select','boolean')),
  CONSTRAINT contact_custom_fields_key_chk CHECK (key ~ '^[a-z0-9_]{1,40}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_custom_fields TO authenticated;
GRANT ALL ON public.contact_custom_fields TO service_role;

ALTER TABLE public.contact_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccf_select_own_tenant" ON public.contact_custom_fields
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

CREATE POLICY "ccf_insert_admin" ON public.contact_custom_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id)
      OR public.is_platform(auth.uid())
    )
  );

CREATE POLICY "ccf_update_admin" ON public.contact_custom_fields
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'sales_manager', tenant_id)
      OR public.is_platform(auth.uid())
    )
  )
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "ccf_delete_admin" ON public.contact_custom_fields
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.has_tenant_role(auth.uid(), 'tenant_admin', tenant_id)
      OR public.has_tenant_role(auth.uid(), 'tenant_owner', tenant_id)
      OR public.is_platform(auth.uid())
    )
  );

CREATE TRIGGER contact_custom_fields_set_updated_at
  BEFORE UPDATE ON public.contact_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();