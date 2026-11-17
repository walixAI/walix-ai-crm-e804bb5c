CREATE OR REPLACE FUNCTION public.trg_call_to_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE activity_id uuid; label text;
BEGIN
IF NEW.contact_id IS NULL THEN RETURN NEW; END IF;
label := CASE NEW.status WHEN 'queued' THEN 'Solicitud de llamada' WHEN 'ringing' THEN 'Marcando al contacto' WHEN 'answered' THEN 'Contacto conectado' WHEN 'completed' THEN 'Llamada finalizada' WHEN 'failed' THEN 'Llamada fallida' WHEN 'no_answer' THEN 'Llamada sin respuesta' WHEN 'busy' THEN 'Línea ocupada' WHEN 'voicemail' THEN 'Buzón de voz' ELSE 'Llamada' END;
SELECT id INTO activity_id FROM public.activities WHERE tenant_id=NEW.tenant_id AND metadata->>'call_id'=NEW.id::text AND metadata->>'source'='automatic_call_result' LIMIT 1;
IF activity_id IS NULL THEN
INSERT INTO public.activities(tenant_id,contact_id,deal_id,agent_id,type,description,occurred_at,metadata) VALUES(NEW.tenant_id,NEW.contact_id,NEW.deal_id,NEW.user_id,'call',label,COALESCE(NEW.ended_at,NEW.started_at,now()),jsonb_build_object('call_id',NEW.id,'source','automatic_call_result','status',NEW.status,'duration',NEW.duration_seconds,'result',label));
ELSE
UPDATE public.activities SET description=label,occurred_at=COALESCE(NEW.ended_at,NEW.started_at,now()),metadata=metadata || jsonb_build_object('status',NEW.status,'duration',NEW.duration_seconds,'result',label) WHERE id=activity_id AND tenant_id=NEW.tenant_id;
END IF;
RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_call_to_activity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trg_call_to_activity() TO service_role;