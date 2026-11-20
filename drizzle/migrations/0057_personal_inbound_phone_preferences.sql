CREATE TABLE public.tenant_call_receiving_preferences (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 phone_enabled boolean NOT NULL DEFAULT false,
 phone_number text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,user_id),
 CONSTRAINT receiving_phone_valid CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$'),
 CONSTRAINT receiving_phone_required CHECK (NOT phone_enabled OR phone_number IS NOT NULL)
);
GRANT SELECT,INSERT,UPDATE ON public.tenant_call_receiving_preferences TO authenticated;
GRANT ALL ON public.tenant_call_receiving_preferences TO service_role;
ALTER TABLE public.tenant_call_receiving_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY receiving_own_select ON public.tenant_call_receiving_preferences FOR SELECT TO authenticated USING (tenant_id=public.get_user_tenant(auth.uid()) AND user_id=auth.uid());
CREATE POLICY receiving_own_insert ON public.tenant_call_receiving_preferences FOR INSERT TO authenticated WITH CHECK (tenant_id=public.get_user_tenant(auth.uid()) AND user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.tenant_id=tenant_call_receiving_preferences.tenant_id AND r.user_id=auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active));
CREATE POLICY receiving_own_update ON public.tenant_call_receiving_preferences FOR UPDATE TO authenticated USING (tenant_id=public.get_user_tenant(auth.uid()) AND user_id=auth.uid()) WITH CHECK (tenant_id=public.get_user_tenant(auth.uid()) AND user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.tenant_id=tenant_call_receiving_preferences.tenant_id AND r.user_id=auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active));
CREATE OR REPLACE FUNCTION public.close_inbound_ringing_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role()='service_role' AND NEW.direction='inbound' AND NEW.status NOT IN ('queued','ringing') THEN
 UPDATE public.notifications SET read_at=coalesce(read_at,now()) WHERE tenant_id=NEW.tenant_id AND type='inbound_call' AND data->>'call_id'=NEW.id::text;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.close_inbound_ringing_alert() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_inbound_ringing_alert() TO service_role;
CREATE TRIGGER calls_close_ringing_alert AFTER UPDATE OF status ON public.calls FOR EACH ROW EXECUTE FUNCTION public.close_inbound_ringing_alert();