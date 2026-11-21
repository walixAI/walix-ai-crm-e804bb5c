CREATE TABLE public.inbound_call_recipients (call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE, tenant_id uuid NOT NULL REFERENCES public.tenants(id), user_id uuid NOT NULL, PRIMARY KEY (call_id,user_id));
GRANT SELECT ON public.inbound_call_recipients TO authenticated;
GRANT ALL ON public.inbound_call_recipients TO service_role;
ALTER TABLE public.inbound_call_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbound_recipient_self_read ON public.inbound_call_recipients FOR SELECT TO authenticated USING (tenant_id=public.get_user_tenant(auth.uid()) AND user_id=auth.uid());
CREATE FUNCTION public.persist_inbound_call_recipients() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role()='service_role' AND NEW.direction='inbound' AND jsonb_typeof(NEW.metadata->'notification_user_ids')='array' THEN
 INSERT INTO public.inbound_call_recipients (call_id,tenant_id,user_id)
 SELECT DISTINCT NEW.id,NEW.tenant_id,ur.user_id FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id AND p.is_active=true WHERE ur.tenant_id=NEW.tenant_id AND (NEW.metadata->'notification_user_ids') @> jsonb_build_array(ur.user_id::text) ON CONFLICT DO NOTHING;
 END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.persist_inbound_call_recipients() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER persist_inbound_recipients AFTER INSERT ON public.calls FOR EACH ROW EXECUTE FUNCTION public.persist_inbound_call_recipients();
ALTER POLICY calls_select ON public.calls USING (((tenant_id = public.get_user_tenant(auth.uid())) AND ((NOT public.is_rep_only(auth.uid(), tenant_id)) OR (user_id = auth.uid()) OR ((contact_id IS NOT NULL) AND public.rep_owns_contact(auth.uid(), contact_id)) OR EXISTS (SELECT 1 FROM public.inbound_call_recipients r WHERE r.call_id=calls.id AND r.tenant_id=calls.tenant_id AND r.user_id=auth.uid()))) OR public.is_platform(auth.uid()));