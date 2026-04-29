-- ============================================================
-- Paso 2/2: Tablas, helpers, RLS y migración de datos
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLAS NUEVAS
-- ------------------------------------------------------------

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'org_starter',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT org_member_role_check CHECK (role IN ('org_owner','org_member'))
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_plan_limits (
  plan text PRIMARY KEY,
  max_tenants integer NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.org_plan_limits ENABLE ROW LEVEL SECURITY;

INSERT INTO public.org_plan_limits (plan, max_tenants, monthly_price) VALUES
  ('org_starter',    1,   0),
  ('org_pyme',       2,   0),
  ('org_growth',     5,   0),
  ('org_enterprise', 999, 0);

-- ------------------------------------------------------------
-- 2. AMPLIAR TABLAS EXISTENTES
-- ------------------------------------------------------------

ALTER TABLE public.tenants
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN trial_ends_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN active_tenant_id uuid;

-- ------------------------------------------------------------
-- 3. HELPERS SECURITY DEFINER
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_platform(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'platform_owner') OR public.has_role(_user_id, 'platform_staff')
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = 'org_owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.org_tenant_count(_org_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.tenants WHERE organization_id = _org_id
$$;

-- get_user_tenant ahora considera active_tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(active_tenant_id, tenant_id) FROM public.profiles WHERE id = _user_id
$$;

-- ------------------------------------------------------------
-- 4. RLS de organizations y organization_members
-- ------------------------------------------------------------

CREATE POLICY "members read own org" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id) OR public.is_platform(auth.uid()));

CREATE POLICY "owners update own org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), id) OR public.is_platform(auth.uid()))
  WITH CHECK (public.is_org_owner(auth.uid(), id) OR public.is_platform(auth.uid()));

CREATE POLICY "authenticated creates org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "platform deletes org" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.is_platform(auth.uid()));

CREATE POLICY "members read own membership" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_owner(auth.uid(), organization_id)
    OR public.is_platform(auth.uid())
  );

CREATE POLICY "owners insert members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(auth.uid(), organization_id) OR public.is_platform(auth.uid()));

CREATE POLICY "owners update members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id) OR public.is_platform(auth.uid()))
  WITH CHECK (public.is_org_owner(auth.uid(), organization_id) OR public.is_platform(auth.uid()));

CREATE POLICY "owners delete members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id) OR public.is_platform(auth.uid()));

CREATE POLICY "read org_plan_limits" ON public.org_plan_limits
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- 5. MIGRACIÓN DE DATOS EXISTENTES
-- ------------------------------------------------------------

DO $$
DECLARE
  t RECORD;
  new_org uuid;
  first_admin uuid;
BEGIN
  FOR t IN SELECT id, name FROM public.tenants WHERE organization_id IS NULL LOOP
    -- Encuentra primer admin del tenant para usar como creador
    SELECT ur.user_id INTO first_admin
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'tenant_admin' AND p.tenant_id = t.id
      LIMIT 1;

    IF first_admin IS NULL THEN
      SELECT id INTO first_admin FROM public.profiles WHERE tenant_id = t.id LIMIT 1;
    END IF;

    -- Si el tenant no tiene ningún miembro, omitirlo (caso raro)
    IF first_admin IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.organizations(name, created_by, plan)
    VALUES (t.name, first_admin, 'org_starter')
    RETURNING id INTO new_org;

    UPDATE public.tenants SET organization_id = new_org WHERE id = t.id;

    INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (new_org, first_admin, 'org_owner')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_roles(user_id, role, tenant_id)
    VALUES (first_admin, 'tenant_owner', t.id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_roles(user_id, role)
    VALUES (first_admin, 'org_owner')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Migrar super_admin → platform_owner
INSERT INTO public.user_roles(user_id, role)
  SELECT user_id, 'platform_owner'::public.app_role
    FROM public.user_roles WHERE role = 'super_admin'
  ON CONFLICT DO NOTHING;

-- Sembrar active_tenant_id para profiles existentes
UPDATE public.profiles SET active_tenant_id = tenant_id WHERE active_tenant_id IS NULL;

-- Tenants huérfanos: crear org placeholder para que NOT NULL no falle
DO $$
DECLARE
  t RECORD;
  ph_org uuid;
  ph_user uuid;
BEGIN
  -- Buscar un platform_owner para usar como created_by placeholder
  SELECT user_id INTO ph_user FROM public.user_roles WHERE role = 'platform_owner' LIMIT 1;
  IF ph_user IS NULL THEN
    SELECT id INTO ph_user FROM public.profiles LIMIT 1;
  END IF;

  IF ph_user IS NOT NULL THEN
    FOR t IN SELECT id, name FROM public.tenants WHERE organization_id IS NULL LOOP
      INSERT INTO public.organizations(name, created_by, plan)
      VALUES (t.name, ph_user, 'org_starter')
      RETURNING id INTO ph_org;
      UPDATE public.tenants SET organization_id = ph_org WHERE id = t.id;
    END LOOP;
  END IF;
END $$;

-- Solo aplicar NOT NULL si todos los tenants tienen organization_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE organization_id IS NULL) THEN
    ALTER TABLE public.tenants ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. ÍNDICES DE INTEGRIDAD
-- ------------------------------------------------------------

-- Garantizar máximo 1 tenant_owner por tenant
CREATE UNIQUE INDEX IF NOT EXISTS one_owner_per_tenant
  ON public.user_roles(tenant_id)
  WHERE role = 'tenant_owner';

CREATE INDEX IF NOT EXISTS idx_tenants_organization_id ON public.tenants(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

-- ------------------------------------------------------------
-- 7. TRIGGER DE SIGNUP: crear org + tenant trial automáticamente
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org uuid;
  new_tenant uuid;
  org_name text;
  tenant_name text;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mi organización');
  tenant_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mi empresa');

  INSERT INTO public.organizations(name, created_by, plan)
  VALUES (org_name, NEW.id, 'org_starter')
  RETURNING id INTO new_org;

  INSERT INTO public.tenants(name, organization_id, plan, trial_ends_at)
  VALUES (tenant_name, new_org, 'starter', now() + interval '14 days')
  RETURNING id INTO new_tenant;

  INSERT INTO public.profiles(id, full_name, email, tenant_id, active_tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    new_tenant,
    new_tenant
  );

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (new_org, NEW.id, 'org_owner');

  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'org_owner');
  INSERT INTO public.user_roles(user_id, role, tenant_id) VALUES (NEW.id, 'tenant_owner', new_tenant);
  INSERT INTO public.user_roles(user_id, role, tenant_id) VALUES (NEW.id, 'tenant_admin', new_tenant);

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 8. ACTUALIZAR RLS QUE REFERENCIAN super_admin → is_platform
-- ------------------------------------------------------------

-- contacts
DROP POLICY IF EXISTS "tenant select contacts" ON public.contacts;
CREATE POLICY "tenant select contacts" ON public.contacts FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- deals
DROP POLICY IF EXISTS "tenant select deals" ON public.deals;
CREATE POLICY "tenant select deals" ON public.deals FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- conversations
DROP POLICY IF EXISTS "tenant select conversations" ON public.conversations;
CREATE POLICY "tenant select conversations" ON public.conversations FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- messages
DROP POLICY IF EXISTS "tenant select messages" ON public.messages;
CREATE POLICY "tenant select messages" ON public.messages FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- activities
DROP POLICY IF EXISTS "tenant select activities" ON public.activities;
CREATE POLICY "tenant select activities" ON public.activities FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- automations
DROP POLICY IF EXISTS "tenant select automations" ON public.automations;
CREATE POLICY "tenant select automations" ON public.automations FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- automation_runs
DROP POLICY IF EXISTS "tenant select automation_runs" ON public.automation_runs;
CREATE POLICY "tenant select automation_runs" ON public.automation_runs FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- ai_suggestions
DROP POLICY IF EXISTS "tenant select ai_suggestions" ON public.ai_suggestions;
CREATE POLICY "tenant select ai_suggestions" ON public.ai_suggestions FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- contact_tags
DROP POLICY IF EXISTS "tenant select contact_tags" ON public.contact_tags;
CREATE POLICY "tenant select contact_tags" ON public.contact_tags FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- pipelines
DROP POLICY IF EXISTS "tenant select pipelines" ON public.pipelines;
CREATE POLICY "tenant select pipelines" ON public.pipelines FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- pipeline_stages
DROP POLICY IF EXISTS "tenant select pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "tenant select pipeline_stages" ON public.pipeline_stages FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- deal_stage_history
DROP POLICY IF EXISTS "tenant select deal_stage_history" ON public.deal_stage_history;
CREATE POLICY "tenant select deal_stage_history" ON public.deal_stage_history FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- message_templates
DROP POLICY IF EXISTS "tenant select message_templates" ON public.message_templates;
CREATE POLICY "tenant select message_templates" ON public.message_templates FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- tasks
DROP POLICY IF EXISTS "tenant select tasks" ON public.tasks;
CREATE POLICY "tenant select tasks" ON public.tasks FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- audit_log
DROP POLICY IF EXISTS "tenant reads own audit" ON public.audit_log;
CREATE POLICY "tenant reads own audit" ON public.audit_log FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_platform(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_platform(auth.uid()));

DROP POLICY IF EXISTS "Super admin manages roles" ON public.user_roles;
CREATE POLICY "Platform manages roles" ON public.user_roles FOR ALL
  USING (public.is_platform(auth.uid()))
  WITH CHECK (public.is_platform(auth.uid()));

-- tenants
DROP POLICY IF EXISTS "Members view their tenant" ON public.tenants;
CREATE POLICY "Members view their tenant" ON public.tenants FOR SELECT
  USING (
    id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR public.is_platform(auth.uid())
  );

DROP POLICY IF EXISTS "super_admin updates any tenant" ON public.tenants;
CREATE POLICY "platform updates any tenant" ON public.tenants FOR UPDATE
  USING (public.is_platform(auth.uid()))
  WITH CHECK (public.is_platform(auth.uid()));

DROP POLICY IF EXISTS "tenant_admin updates own tenant" ON public.tenants;
CREATE POLICY "tenant admin or owner updates own tenant" ON public.tenants FOR UPDATE
  USING (
    id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'tenant_owner'))
  )
  WITH CHECK (
    id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'tenant_owner'))
  );

-- invitations
DROP POLICY IF EXISTS "super_admin manages all invites" ON public.invitations;
CREATE POLICY "platform manages all invites" ON public.invitations FOR ALL TO authenticated
  USING (public.is_platform(auth.uid()))
  WITH CHECK (public.is_platform(auth.uid()));

DROP POLICY IF EXISTS "tenant_admin manages invites" ON public.invitations;
CREATE POLICY "tenant admin or owner manages invites" ON public.invitations FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'tenant_owner'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'tenant_owner'))
  );

-- ------------------------------------------------------------
-- 9. BOOTSTRAP HELPER (función manual, sin email hardcoded)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bootstrap_platform_owner(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid;
BEGIN
  SELECT id INTO me FROM auth.users WHERE email = _email;
  IF me IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', _email;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (me, 'platform_owner')
    ON CONFLICT DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_platform_owner(text) FROM PUBLIC, anon, authenticated;