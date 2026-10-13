CREATE OR REPLACE FUNCTION public.change_tenant_member_role(p_tenant_id uuid,p_user_id uuid,p_role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid := auth.uid(); previous_roles jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501'; END IF;
 IF p_tenant_id IS DISTINCT FROM public.get_user_tenant(actor) OR NOT (public.has_tenant_role(actor,'tenant_owner',p_tenant_id) OR public.is_platform(actor)) THEN
 RAISE EXCEPTION 'Solo el propietario puede cambiar los roles de su empresa' USING ERRCODE='42501'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('tenant_owner','tenant_admin','sales_manager','sales_rep') THEN RAISE EXCEPTION 'Rol no permitido' USING ERRCODE='42501'; END IF;
 IF actor=p_user_id THEN RAISE EXCEPTION 'No puedes cambiar tu propio rol'; END IF;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'El usuario no pertenece a esta empresa' USING ERRCODE='42501'; END IF;
 IF public.has_tenant_role(p_user_id,'tenant_owner',p_tenant_id) AND p_role<>'tenant_owner'
 AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE tenant_id=p_tenant_id AND role='tenant_owner' AND user_id<>p_user_id) THEN RAISE EXCEPTION 'La empresa debe conservar un propietario'; END IF;
 SELECT coalesce(jsonb_agg(role),'[]'::jsonb) INTO previous_roles FROM public.user_roles WHERE tenant_id=p_tenant_id AND user_id=p_user_id AND role IN ('tenant_owner','tenant_admin','sales_manager','sales_rep');
 DELETE FROM public.user_roles WHERE tenant_id=p_tenant_id AND user_id=p_user_id AND role IN ('tenant_owner','tenant_admin','sales_manager','sales_rep');
 INSERT INTO public.user_roles(user_id,tenant_id,role) VALUES(p_user_id,p_tenant_id,p_role);
 INSERT INTO public.audit_log(tenant_id,actor_id,actor_email,action,target_type,target_id,metadata)
 SELECT p_tenant_id,actor,email,'team.member.role_changed','user',p_user_id,jsonb_build_object('previous_roles',previous_roles,'role',p_role) FROM public.profiles WHERE id=actor;
END $$;
REVOKE ALL ON FUNCTION public.change_tenant_member_role(uuid,uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_tenant_member_role(uuid,uuid,public.app_role) TO authenticated;
