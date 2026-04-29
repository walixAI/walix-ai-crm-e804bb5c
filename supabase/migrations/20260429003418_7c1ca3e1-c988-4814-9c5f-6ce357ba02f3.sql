-- Tenants: nuevos campos
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-MX',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_primary text,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS mrr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nps integer;

-- Profiles: nuevos campos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS email text;

-- Update policies para tenants
DROP POLICY IF EXISTS "tenant_admin updates own tenant" ON public.tenants;
CREATE POLICY "tenant_admin updates own tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(),'tenant_admin'))
  WITH CHECK (id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(),'tenant_admin'));

DROP POLICY IF EXISTS "super_admin updates any tenant" ON public.tenants;
CREATE POLICY "super_admin updates any tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Plan limits
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan text PRIMARY KEY,
  max_users integer NOT NULL,
  max_active_automations integer NOT NULL,
  max_pipelines integer NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0
);
INSERT INTO public.plan_limits (plan, max_users, max_active_automations, max_pipelines, monthly_price) VALUES
  ('starter', 1, 0, 1, 0),
  ('pyme', 5, 3, 3, 990),
  ('growth', 15, 99, 10, 2490),
  ('enterprise', 999, 99, 99, 5990)
ON CONFLICT (plan) DO NOTHING;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read plan_limits" ON public.plan_limits;
CREATE POLICY "read plan_limits" ON public.plan_limits FOR SELECT TO authenticated USING (true);

-- Invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_admin manages invites" ON public.invitations;
CREATE POLICY "tenant_admin manages invites" ON public.invitations FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(),'tenant_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(),'tenant_admin'));

DROP POLICY IF EXISTS "super_admin manages all invites" ON public.invitations;
CREATE POLICY "super_admin manages all invites" ON public.invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant reads own audit" ON public.audit_log;
CREATE POLICY "tenant reads own audit" ON public.audit_log FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "authenticated inserts audit" ON public.audit_log;
CREATE POLICY "authenticated inserts audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON public.audit_log (tenant_id, created_at DESC);

-- Helper para SuperAdmin
CREATE OR REPLACE FUNCTION public.tenant_active_users(_tenant_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.profiles WHERE tenant_id = _tenant_id AND is_active = true
$$;

-- Storage bucket para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets','tenant-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tenant_admin uploads logos" ON storage.objects;
CREATE POLICY "tenant_admin uploads logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id='tenant-assets'
    AND public.has_role(auth.uid(),'tenant_admin')
    AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
  );

DROP POLICY IF EXISTS "tenant_admin updates logos" ON storage.objects;
CREATE POLICY "tenant_admin updates logos" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id='tenant-assets'
    AND public.has_role(auth.uid(),'tenant_admin')
    AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
  );

DROP POLICY IF EXISTS "public reads logos" ON storage.objects;
CREATE POLICY "public reads logos" ON storage.objects FOR SELECT TO public
  USING (bucket_id='tenant-assets');