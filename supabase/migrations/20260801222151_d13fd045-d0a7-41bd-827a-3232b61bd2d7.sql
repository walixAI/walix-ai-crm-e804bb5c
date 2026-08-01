-- 1) Blindar UPDATE de profiles: no se puede robar identidad ni saltar de tenant
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2) Trigger: solo puedes cambiar tu tenant a uno donde tengas rol asignado
CREATE OR REPLACE FUNCTION public.enforce_profile_tenant_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cambios hechos por funciones internas (service_role / definer sin auth.uid) se permiten
  IF auth.uid() IS NULL OR auth.uid() <> NEW.id THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     AND NEW.tenant_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = NEW.id AND ur.tenant_id = NEW.tenant_id
     ) THEN
    RAISE EXCEPTION 'No tienes acceso a ese tenant' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.active_tenant_id IS DISTINCT FROM OLD.active_tenant_id
     AND NEW.active_tenant_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = NEW.id AND ur.tenant_id = NEW.active_tenant_id
     ) THEN
    RAISE EXCEPTION 'No tienes acceso a ese tenant' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_tenant_membership ON public.profiles;
CREATE TRIGGER trg_enforce_profile_tenant_membership
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_tenant_membership();

-- 3) has_role sensible al tenant activo: un rol otorgado en el tenant A
--    no otorga privilegios mientras el usuario opera en el tenant B.
--    Los roles globales (tenant_id NULL: platform_*, org_*) siguen igual.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (
        ur.tenant_id IS NULL
        OR ur.tenant_id = (
          SELECT COALESCE(p.active_tenant_id, p.tenant_id)
          FROM public.profiles p WHERE p.id = _user_id
        )
      )
  )
$$;

-- 4) Rol explícito por tenant, para chequeos que necesitan tenant concreto
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _role app_role, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role AND ur.tenant_id = _tenant_id
  )
$$;

-- 5) whatsapp_webhook_log: acotar lectura al tenant dueño del canal
DROP POLICY IF EXISTS "tenant read own webhook log" ON public.whatsapp_webhook_log;
CREATE POLICY "tenant read own webhook log"
ON public.whatsapp_webhook_log FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()));