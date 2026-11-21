CREATE TABLE public.tenant_inbound_call_settings (tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id), unassigned_mode text NOT NULL DEFAULT 'supervisors' CHECK (unassigned_mode IN ('specific','all','supervisors','advisors')), unassigned_user_id uuid, phone_mode text NOT NULL DEFAULT 'all' CHECK (phone_mode IN ('none','all','selected')), allowed_user_ids uuid[] NOT NULL DEFAULT '{}', updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.tenant_inbound_call_settings TO authenticated;
GRANT ALL ON public.tenant_inbound_call_settings TO service_role;
ALTER TABLE public.tenant_inbound_call_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbound_settings_active_tenant_read ON public.tenant_inbound_call_settings FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
COMMENT ON COLUMN public.tenant_call_receiving_preferences.phone_number IS 'DEPRECATED: inbound destination is resolved from the current advisor profiles.phone; retained for audit only';
CREATE OR REPLACE FUNCTION public.notify_inbound_call_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE missed boolean; who text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
 missed := NEW.answered_at IS NULL AND NEW.status IN ('completed','no_answer','busy','failed','voicemail');
 IF TG_OP = 'UPDATE' THEN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF missed AND OLD.answered_at IS NULL AND OLD.status IN ('completed','no_answer','busy','failed','voicemail') THEN RETURN NEW; END IF;
  IF NOT missed AND NEW.status <> 'ringing' THEN RETURN NEW; END IF;
 ELSIF NOT missed AND NEW.status <> 'ringing' THEN RETURN NEW; END IF;
 SELECT name INTO who FROM public.contacts WHERE id = NEW.contact_id AND tenant_id = NEW.tenant_id;
 who := coalesce(who,NEW.from_number,'Número desconocido');
 INSERT INTO public.notifications (tenant_id,user_id,type,title,body,link,severity,data)
 SELECT NEW.tenant_id,r.user_id,CASE WHEN missed THEN 'missed_inbound_call' ELSE 'inbound_call' END,
 CASE WHEN missed THEN 'Llamada entrante no atendida: ' ELSE 'Llamada entrante: ' END || who,
 CASE WHEN missed THEN 'Devuelve la llamada. Número: ' ELSE 'Hay una llamada entrante. Número: ' END || coalesce(NEW.from_number,'No disponible'),
 '/llamadas', CASE WHEN missed THEN 'warning'::public.notification_severity ELSE 'info'::public.notification_severity END,
 jsonb_build_object('call_id',NEW.id,'contact_id',NEW.contact_id,'unassigned',NEW.contact_id IS NULL OR coalesce((NEW.metadata->>'unassigned')::boolean,NEW.user_id IS NULL),'caller_name',who,'from_number',NEW.from_number,'started_at',NEW.started_at,'status',NEW.status)
 FROM (
 SELECT DISTINCT ur.user_id FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id AND p.is_active=true
 WHERE ur.tenant_id=NEW.tenant_id AND (
 CASE WHEN NEW.metadata ? 'notification_user_ids' THEN (NEW.metadata->'notification_user_ids') @> jsonb_build_array(ur.user_id::text)
 ELSE ur.user_id=NEW.user_id OR ((missed OR NEW.user_id IS NULL) AND ur.role IN ('tenant_admin','tenant_owner','sales_manager')) END)
 ) r;
 RETURN NEW;
END $function$;