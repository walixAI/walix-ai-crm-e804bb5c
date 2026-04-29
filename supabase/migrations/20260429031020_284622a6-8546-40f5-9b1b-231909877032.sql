-- 1) Actualizar handle_new_user a 21 días de trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 2) Helper: días restantes del trial
CREATE OR REPLACE FUNCTION public.trial_days_left(_tenant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (trial_ends_at - now())) / 86400)::int
  )
  FROM public.tenants
  WHERE id = _tenant_id;
$$;

-- 3) Downgrade de trials vencidos (puede llamarse desde cron o manual)
CREATE OR REPLACE FUNCTION public.downgrade_expired_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected int;
BEGIN
  UPDATE public.tenants
  SET plan = 'starter'
  WHERE trial_ends_at IS NOT NULL
    AND trial_ends_at < now()
    AND plan IN ('pyme','growth','enterprise');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4) Sincronizar plan_limits con la tabla pública nueva
INSERT INTO public.plan_limits (plan, max_users, max_pipelines, max_active_automations, monthly_price)
VALUES
  ('starter',    2,  1, 0,    0),
  ('pyme',       5,  2, 3,    499),
  ('growth',     15, 5, 9999, 999),
  ('enterprise', 9999, 9999, 9999, 1999)
ON CONFLICT (plan) DO UPDATE
  SET max_users = EXCLUDED.max_users,
      max_pipelines = EXCLUDED.max_pipelines,
      max_active_automations = EXCLUDED.max_active_automations,
      monthly_price = EXCLUDED.monthly_price;