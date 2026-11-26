CREATE OR REPLACE FUNCTION public.trg_call_to_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_activity_id uuid;
  v_label text;
  v_conn uuid;
  v_effective boolean;
BEGIN
  IF NEW.contact_id IS NULL THEN RETURN NEW; END IF;
  v_label := CASE NEW.status
    WHEN 'queued' THEN 'Solicitud de llamada'
    WHEN 'ringing' THEN 'Marcando al contacto'
    WHEN 'answered' THEN 'Contacto conectado'
    WHEN 'completed' THEN 'Llamada finalizada'
    WHEN 'failed' THEN 'Llamada fallida'
    WHEN 'no_answer' THEN 'Llamada sin respuesta'
    WHEN 'busy' THEN 'Línea ocupada'
    WHEN 'voicemail' THEN 'Buzón de voz'
    ELSE 'Llamada' END;
  v_effective := NEW.status = 'answered' OR (
    NEW.status = 'completed' AND (
      COALESCE(NEW.duration_seconds, 0) > 0
      OR NEW.answered_at IS NOT NULL
      OR NULLIF(btrim(COALESCE(NEW.ai_summary, '')), '') IS NOT NULL
    )
  );
  IF v_effective AND NEW.status <> 'answered' THEN
    v_label := 'Llamada finalizada';
  END IF;
  v_conn := CASE
    WHEN v_effective THEN NULL
    ELSE CASE NEW.status
      WHEN 'no_answer' THEN (SELECT o.id FROM public.activity_outcomes o WHERE o.tenant_id = NEW.tenant_id AND o.is_active AND o.is_connection_result AND o.label IN ('No contestó','Sin respuesta','Llamada sin respuesta') ORDER BY o.position LIMIT 1)
      WHEN 'busy' THEN (SELECT o.id FROM public.activity_outcomes o WHERE o.tenant_id = NEW.tenant_id AND o.is_active AND o.is_connection_result AND o.label IN ('Línea ocupada','Ocupado','No contestó') ORDER BY o.position LIMIT 1)
      WHEN 'voicemail' THEN (SELECT o.id FROM public.activity_outcomes o WHERE o.tenant_id = NEW.tenant_id AND o.is_active AND o.is_connection_result AND o.label IN ('Buzón de voz','Buzón','Contestó buzón') ORDER BY o.position LIMIT 1)
      WHEN 'failed' THEN (SELECT o.id FROM public.activity_outcomes o WHERE o.tenant_id = NEW.tenant_id AND o.is_active AND o.is_connection_result AND o.label IN ('Falló','Número inválido','Llamada fallida','No contestó') ORDER BY o.position LIMIT 1)
      ELSE NULL END
  END;
  SELECT id INTO v_activity_id FROM public.activities
   WHERE tenant_id = NEW.tenant_id AND metadata->>'call_id' = NEW.id::text
     AND metadata->>'source' = 'automatic_call_result' LIMIT 1;
  IF v_activity_id IS NULL THEN
    INSERT INTO public.activities(tenant_id,contact_id,deal_id,agent_id,type,description,occurred_at,metadata)
    VALUES(NEW.tenant_id,NEW.contact_id,NEW.deal_id,NEW.user_id,'call',v_label,
      COALESCE(NEW.ended_at,NEW.started_at,now()),
      jsonb_build_object('call_id',NEW.id,'source','automatic_call_result','status',NEW.status,
        'duration',NEW.duration_seconds,'result',v_label,'is_effective',v_effective,'outcome_id',v_conn));
  ELSE
    UPDATE public.activities SET description = v_label,
      occurred_at = COALESCE(NEW.ended_at,NEW.started_at,now()),
      metadata = metadata || jsonb_build_object('status',NEW.status,'duration',NEW.duration_seconds,
        'result',v_label,'is_effective',v_effective,'outcome_id',v_conn)
     WHERE id = v_activity_id AND tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.trg_call_to_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_call_to_activity() TO service_role;