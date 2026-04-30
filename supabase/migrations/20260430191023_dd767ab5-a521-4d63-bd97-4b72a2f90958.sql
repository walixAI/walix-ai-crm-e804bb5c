-- 1. Nuevas columnas en tenants (perfil del negocio capturado en onboarding)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS sales_channel text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;

-- 2. Token y aceptación en invitations
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);

-- 3. Índices únicos para que el sembrado sea idempotente
CREATE UNIQUE INDEX IF NOT EXISTS contact_tags_tenant_name_idx
  ON public.contact_tags(tenant_id, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS message_templates_tenant_name_idx
  ON public.message_templates(tenant_id, lower(name));

-- 4. Función SECURITY DEFINER para aceptar invitaciones
-- Solo el usuario autenticado cuyo email coincide con el de la invitación puede aceptarla.
CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Actualiza profile (tenant del invitado)
  UPDATE public.profiles
  SET tenant_id = inv.tenant_id,
      active_tenant_id = inv.tenant_id,
      onboarded = true
  WHERE id = user_id_v;

  -- Asigna rol en el tenant
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (user_id_v, inv.role, inv.tenant_id)
  ON CONFLICT DO NOTHING;

  -- Marca invitación como aceptada
  UPDATE public.invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = user_id_v
  WHERE id = inv.id;

  RETURN jsonb_build_object(
    'tenant_id', inv.tenant_id,
    'role', inv.role
  );
END;
$$;

-- Permitir que cualquier usuario autenticado invoque la función
REVOKE ALL ON FUNCTION public.accept_invitation(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;