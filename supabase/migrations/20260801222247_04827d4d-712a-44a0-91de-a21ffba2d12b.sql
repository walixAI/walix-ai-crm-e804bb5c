CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  user_email text;
  user_id_v uuid;
BEGIN
  user_id_v := auth.uid();
  IF user_id_v IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = user_id_v;
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT * INTO inv FROM public.invitations WHERE token = _token LIMIT 1;
  IF inv IS NULL THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;
  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_already_accepted';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'invitation_expired';
  END IF;
  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'invitation_email_mismatch';
  END IF;

  -- Primero el rol en el tenant (requisito del guard de aislamiento)
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (user_id_v, inv.role, inv.tenant_id)
  ON CONFLICT DO NOTHING;

  -- Luego el cambio de tenant del perfil
  UPDATE public.profiles
  SET tenant_id = inv.tenant_id,
      active_tenant_id = inv.tenant_id,
      onboarded = true
  WHERE id = user_id_v;

  UPDATE public.invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = user_id_v
  WHERE id = inv.id;

  RETURN jsonb_build_object('tenant_id', inv.tenant_id, 'role', inv.role);
END;
$function$;