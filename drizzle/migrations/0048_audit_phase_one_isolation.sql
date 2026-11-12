CREATE OR REPLACE FUNCTION public.audit_can_manage_tenant(_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND _tenant_id = public.get_user_tenant(auth.uid()) AND (public.is_platform(auth.uid()) OR public.has_tenant_role(auth.uid(),'tenant_owner',_tenant_id) OR public.has_tenant_role(auth.uid(),'tenant_admin',_tenant_id)); $$;
REVOKE ALL ON FUNCTION public.audit_can_manage_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_can_manage_tenant(uuid) TO authenticated, service_role;
CREATE POLICY audit_automations_insert ON public.automations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.audit_can_manage_tenant(tenant_id));
CREATE POLICY audit_automations_update ON public.automations AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.audit_can_manage_tenant(tenant_id)) WITH CHECK (public.audit_can_manage_tenant(tenant_id));
CREATE POLICY audit_automations_delete ON public.automations AS RESTRICTIVE FOR DELETE TO authenticated USING (public.audit_can_manage_tenant(tenant_id));
CREATE POLICY audit_lead_keys ON public.lead_intake_keys AS RESTRICTIVE FOR ALL TO authenticated USING (public.audit_can_manage_tenant(tenant_id)) WITH CHECK (public.audit_can_manage_tenant(tenant_id));
CREATE OR REPLACE FUNCTION public.contact_last_inbound(_tenant_id uuid,_contact_ids uuid[]) RETURNS TABLE(contact_id uuid,last_inbound timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT cv.contact_id, max(coalesce(m.sent_at,m.created_at)) FROM public.conversations cv JOIN public.messages m ON m.conversation_id=cv.id AND m.tenant_id=cv.tenant_id WHERE cv.tenant_id=_tenant_id AND cv.contact_id=ANY(_contact_ids) AND m.direction='inbound' AND (auth.role()='service_role' OR (auth.uid() IS NOT NULL AND _tenant_id=public.get_user_tenant(auth.uid()) AND (NOT public.is_rep_only(auth.uid(),_tenant_id) OR public.rep_owns_contact(auth.uid(),cv.contact_id)))) GROUP BY cv.contact_id; $$;
CREATE OR REPLACE FUNCTION public.open_deal_for_contact(_contact_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT d.id FROM public.deals d WHERE d.contact_id=_contact_id AND NOT coalesce(d.is_won,false) AND NOT coalesce(d.is_lost,false) AND (auth.role()='service_role' OR (auth.uid() IS NOT NULL AND d.tenant_id=public.get_user_tenant(auth.uid()) AND (NOT public.is_rep_only(auth.uid(),d.tenant_id) OR public.rep_owns_contact(auth.uid(),d.contact_id)))) ORDER BY d.updated_at DESC,d.id LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.contact_last_inbound(uuid,uuid[]), public.open_deal_for_contact(uuid), public.ensure_recurrence_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_last_inbound(uuid,uuid[]), public.open_deal_for_contact(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_recurrence_subscription(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_recurrence_subscription(uuid) TO service_role;
ALTER TABLE public.call_channels ADD COLUMN credentials_configured boolean GENERATED ALWAYS AS (credentials_encrypted IS NOT NULL) STORED;
DO $$ DECLARE t text; cols text; BEGIN
 FOREACH t IN ARRAY ARRAY['email_accounts','email_providers','call_channels','whatsapp_channels'] LOOP
   EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
   SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped AND attname NOT IN ('secret_ciphertext','credentials_encrypted','webhook_token','access_token','access_token_secret_name','last_webhook_payload','sync_cursor');
   EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated',cols,t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
ALTER TABLE public.web_chat_sessions ADD COLUMN contact_isolated boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.web_chat_sessions.contact_isolated IS 'True only for a contact created for this visitor session; existing contacts are never trusted from claimed phone/email.';
DO $$ DECLARE fn record; def text; BEGIN
 FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_user_run_rate','get_user_profitability') LOOP
   def := pg_get_functiondef(fn.oid);
   def := replace(def, 'IF NOT (public.user_can_use_tenant(auth.uid(), _tenant_id) OR public.is_platform(auth.uid())) THEN', 'IF auth.uid() IS NULL OR _tenant_id IS DISTINCT FROM public.get_user_tenant(auth.uid()) OR (public.is_rep_only(auth.uid(), _tenant_id) AND _user_id IS DISTINCT FROM auth.uid()) OR NOT (public.user_can_use_tenant(auth.uid(), _tenant_id) OR public.is_platform(auth.uid())) THEN');
   def := replace(def,'AND updated_at >= v_start AND updated_at < v_end','AND won_at >= v_start AND won_at < v_end');
   EXECUTE def;
 END LOOP;
END $$;