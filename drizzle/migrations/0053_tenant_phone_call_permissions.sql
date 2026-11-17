CREATE TABLE public.tenant_phone_call_settings (tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE, allow_all boolean NOT NULL DEFAULT true, allowed_user_ids uuid[] NOT NULL DEFAULT '{}', updated_by uuid REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.tenant_phone_call_settings TO authenticated;
GRANT ALL ON public.tenant_phone_call_settings TO service_role;
ALTER TABLE public.tenant_phone_call_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY phone_settings_read ON public.tenant_phone_call_settings FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.tenant_id=tenant_phone_call_settings.tenant_id));
COMMENT ON TABLE public.tenant_phone_call_settings IS 'Phone bridge authorization; writes only through owner-authorized telephony-api. Missing settings preserve all-users access.';