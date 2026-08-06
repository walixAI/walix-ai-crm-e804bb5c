CREATE OR REPLACE FUNCTION public.get_invitation_public(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv record;
  t_name text;
BEGIN
  SELECT * INTO inv FROM public.invitations WHERE token = _token LIMIT 1;
  IF inv IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  SELECT name INTO t_name FROM public.tenants WHERE id = inv.tenant_id;

  IF inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_accepted', 'email', inv.email, 'tenant_name', t_name);
  END IF;
  IF inv.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'email', inv.email, 'tenant_name', t_name);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'email', inv.email,
    'role', inv.role,
    'tenant_name', t_name,
    'has_account', EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(inv.email))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_public(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_org uuid;
  new_tenant uuid;
  org_name text;
  tenant_name text;
BEGIN
  -- Usuario que llega por invitación: no se crea organización/tenant propio
  IF COALESCE(NEW.raw_user_meta_data->>'invitation_token', '') <> '' THEN
    INSERT INTO public.profiles(id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  org_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mi organización');
  tenant_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mi empresa');

  INSERT INTO public.organizations(name, created_by, plan)
  VALUES (org_name, NEW.id, 'org_starter')
  RETURNING id INTO new_org;

  INSERT INTO public.tenants(name, organization_id, plan, trial_ends_at)
  VALUES (tenant_name, new_org, 'starter', now() + interval '21 days')
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