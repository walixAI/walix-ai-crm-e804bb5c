CREATE UNIQUE INDEX calls_inbound_provider_unique ON public.calls (tenant_id, channel_id, provider_call_id) WHERE direction = 'inbound' AND provider_call_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.notify_inbound_call_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  missed boolean;
  who text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  missed := NEW.answered_at IS NULL AND NEW.status IN ('completed','no_answer','busy','failed','voicemail');
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    IF missed AND OLD.status IN ('completed','no_answer','busy','failed','voicemail') THEN RETURN NEW; END IF;
    IF NOT missed AND NEW.status <> 'ringing' THEN RETURN NEW; END IF;
  ELSIF NOT missed AND NEW.status <> 'ringing' THEN RETURN NEW;
  END IF;
  SELECT name INTO who FROM public.contacts WHERE id = NEW.contact_id AND tenant_id = NEW.tenant_id;
  who := coalesce(who,NEW.from_number,'Número desconocido');
  INSERT INTO public.notifications (tenant_id,user_id,type,title,body,link,severity,data)
  SELECT NEW.tenant_id,r.user_id,CASE WHEN missed THEN 'missed_inbound_call' ELSE 'inbound_call' END,
    CASE WHEN missed THEN 'Llamada entrante no atendida: ' ELSE 'Llamada entrante: ' END || who,
    CASE WHEN missed THEN 'Devuelve la llamada. Número: ' ELSE 'Hay una llamada entrante. Número: ' END || coalesce(NEW.from_number,'No disponible'),
    '/llamadas', CASE WHEN missed THEN 'warning'::public.notification_severity ELSE 'info'::public.notification_severity END,
    jsonb_build_object('call_id',NEW.id,'contact_id',NEW.contact_id,'unassigned',NEW.user_id IS NULL)
  FROM (
    SELECT DISTINCT ur.user_id FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id AND p.is_active=true
    WHERE ur.tenant_id=NEW.tenant_id AND (ur.user_id=NEW.user_id OR ((missed OR NEW.user_id IS NULL) AND ur.role IN ('tenant_admin','tenant_owner','sales_manager')))
  ) r;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_inbound_call_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notify_inbound_call_event() TO service_role;
CREATE TRIGGER calls_notify_inbound AFTER INSERT OR UPDATE OF status ON public.calls FOR EACH ROW EXECUTE FUNCTION public.notify_inbound_call_event();