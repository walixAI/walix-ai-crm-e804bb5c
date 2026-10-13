CREATE OR REPLACE FUNCTION public.whatsapp_conversation_channel_ready(p_conversation_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; ready boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT * INTO c FROM public.conversations WHERE id=p_conversation_id AND tenant_id=public.get_user_tenant(auth.uid());
 IF NOT FOUND OR (public.is_rep_only(auth.uid(),c.tenant_id) AND NOT public.rep_owns_conversation(auth.uid(),c.id)) THEN RETURN false; END IF;
 IF c.channel_id IS NOT NULL THEN
 SELECT status='connected' AND phone_number_id IS NOT NULL INTO ready FROM public.whatsapp_channels WHERE id=c.channel_id AND tenant_id=c.tenant_id;
 RETURN coalesce(ready,false);
 END IF;
 RETURN EXISTS(SELECT 1 FROM public.whatsapp_channels WHERE tenant_id=c.tenant_id AND kind='clients' AND status='connected' AND NOT is_platform AND phone_number_id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_conversation_channel_ready(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_conversation_channel_ready(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reassign_contact_atomic(p_contact_id uuid,p_new_owner_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); tid uuid; c record; supervisor boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501'; END IF;
 tid:=public.get_user_tenant(actor);
 SELECT * INTO c FROM public.contacts WHERE id=p_contact_id AND tenant_id=tid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contacto no disponible' USING ERRCODE='42501'; END IF;
 supervisor:=public.is_platform(actor) OR public.has_tenant_role(actor,'tenant_owner',tid) OR public.has_tenant_role(actor,'tenant_admin',tid) OR public.has_tenant_role(actor,'sales_manager',tid);
 IF NOT supervisor AND NOT (public.has_tenant_role(actor,'sales_rep',tid) AND public.rep_owns_contact(actor,c.id)) THEN RAISE EXCEPTION 'Solo puedes reasignar tus contactos' USING ERRCODE='42501'; END IF;
 IF p_new_owner_id IS NULL AND NOT supervisor THEN RAISE EXCEPTION 'Selecciona un asesor de tu empresa' USING ERRCODE='42501'; END IF;
 IF p_new_owner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_new_owner_id AND p.tenant_id=tid AND coalesce(p.is_active,true) AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.tenant_id=tid AND r.role IN ('sales_rep','sales_manager','tenant_admin','tenant_owner'))) THEN RAISE EXCEPTION 'El asesor debe estar activo en tu empresa' USING ERRCODE='42501'; END IF;
 UPDATE public.contacts SET owner_id=p_new_owner_id WHERE id=c.id AND tenant_id=tid;
 UPDATE public.deals SET owner_id=p_new_owner_id WHERE contact_id=c.id AND tenant_id=tid AND NOT is_won AND NOT is_lost;
 UPDATE public.conversations SET assignee_id=p_new_owner_id WHERE contact_id=c.id AND tenant_id=tid;
 UPDATE public.tasks SET assignee_id=p_new_owner_id WHERE tenant_id=tid AND NOT completed AND (contact_id=c.id OR deal_id IN(SELECT id FROM public.deals WHERE contact_id=c.id AND tenant_id=tid AND NOT is_won AND NOT is_lost));
 INSERT INTO public.audit_log(tenant_id,actor_id,action,target_type,target_id,metadata) VALUES(tid,actor,'contact.reassigned','contact',c.id,jsonb_build_object('previous_owner_id',c.owner_id,'owner_id',p_new_owner_id));
END $$;
REVOKE ALL ON FUNCTION public.reassign_contact_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reassign_contact_atomic(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_opportunity_labels() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s record; product_name text; fields jsonb; vals jsonb;
BEGIN
 IF NEW.stage_id IS NOT NULL THEN SELECT name INTO s FROM public.pipeline_stages WHERE id=NEW.stage_id AND tenant_id=NEW.tenant_id; IF FOUND THEN NEW.stage_name:=s.name; END IF; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.name IS DISTINCT FROM OLD.name AND coalesce(trim(NEW.name),'')<>'' THEN RETURN NEW; END IF;
  IF NEW.product_category_id IS NOT DISTINCT FROM OLD.product_category_id THEN RETURN NEW; END IF;
 END IF;
 SELECT name INTO product_name FROM public.product_categories WHERE id=NEW.product_category_id AND tenant_id=NEW.tenant_id;
 -- An explicit program belongs to this opportunity; never replace it with an earlier contact profile.
 IF product_name IS NOT NULL THEN NEW.name:=product_name; RETURN NEW; END IF;
 IF TG_OP='INSERT' AND coalesce(trim(NEW.name),'')<>'' AND NEW.name NOT ILIKE 'Oportunidad%' AND NEW.name NOT ILIKE 'Prospecto%' THEN RETURN NEW; END IF;
 SELECT custom_fields INTO fields FROM public.contacts WHERE id=NEW.contact_id AND tenant_id=NEW.tenant_id;
 vals:=public.profile_opportunity_values(NEW.tenant_id,fields);
 IF TG_OP='INSERT' AND coalesce(NEW.amount,0)=0 AND vals->>'amount' IS NOT NULL THEN NEW.amount:=(vals->>'amount')::numeric; NEW.profile_auto_amount:=NEW.amount; END IF;
 IF vals->>'name' IS NOT NULL THEN NEW.name:=vals->>'name'; NEW.profile_auto_name:=NEW.name; NEW.product_category_id:=coalesce((vals->>'category_id')::uuid,NEW.product_category_id); END IF;
 RETURN NEW;
END $$;