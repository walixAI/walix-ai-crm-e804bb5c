CREATE OR REPLACE FUNCTION public.advance_deal_to_stage(_deal_id uuid, _pattern text, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record; tgt record;
BEGIN
  SELECT dl.id, dl.is_won, dl.is_lost, s.pipeline_id, s.position INTO d
  FROM deals dl JOIN pipeline_stages s ON s.id = dl.stage_id WHERE dl.id = _deal_id;
  IF d IS NULL OR COALESCE(d.is_won,false) OR COALESCE(d.is_lost,false) THEN RETURN false; END IF;
  SELECT * INTO tgt FROM pipeline_stages
   WHERE pipeline_id = d.pipeline_id AND NOT COALESCE(is_won,false) AND NOT COALESCE(is_lost,false)
     AND lower(trim(name)) ~ _pattern
   ORDER BY position LIMIT 1;
  IF tgt IS NULL OR tgt.position <= d.position THEN RETURN false; END IF;
  PERFORM set_config('app.auto_stage_event', 'auto:' || _reason, true);
  UPDATE deals SET stage_id = tgt.id, stage_name = tgt.name, updated_at = now() WHERE id = _deal_id;
  PERFORM set_config('app.auto_stage_event', '', true);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.advance_deal_to_stage(uuid,text,text) FROM anon, authenticated, public;

-- Mensaje saliente sin respuesta previa: Intento de contacto
CREATE OR REPLACE FUNCTION public.trg_attempt_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; v uuid;
BEGIN
  IF NEW.direction::text <> 'outbound' THEN RETURN NEW; END IF;
  SELECT contact_id, deal_id INTO c FROM conversations WHERE id = NEW.conversation_id;
  v := COALESCE(c.deal_id, public.open_deal_for_contact(c.contact_id));
  IF v IS NOT NULL THEN PERFORM public.advance_deal_to_stage(v, '^intento de contacto$', 'intento'); END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_messages_attempt ON public.messages;
CREATE TRIGGER trg_messages_attempt AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.trg_attempt_on_message();

-- Hitos según la tipificación
CREATE OR REPLACE FUNCTION public.trg_milestones_on_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid; res text;
BEGIN
  res := lower(COALESCE(NEW.metadata->>'result', NEW.metadata->>'outcome', ''));
  v := COALESCE(NEW.deal_id, public.open_deal_for_contact(NEW.contact_id));
  IF v IS NULL THEN RETURN NEW; END IF;
  IF res ~ '(no contest|buz[oó]n|sin respuesta|no respond|apagad|intento)' OR NEW.metadata->>'direction' = 'out' AND res = '' THEN
    PERFORM public.advance_deal_to_stage(v, '^intento de contacto$', 'intento');
  END IF;
  IF res ~ 'calificad' THEN
    PERFORM public.advance_deal_to_stage(v, '^calificad', 'calificado');
  END IF;
  IF res ~ '(agend|cita|entrevista|reuni)' THEN
    PERFORM public.advance_deal_to_stage(v, '^(reuni[oó]n agendada|entrevista|agendado|cita)', 'agendado');
  END IF;
  IF res ~ '(asisti|propuesta|ficha|inscripci)' THEN
    PERFORM public.advance_deal_to_stage(v, '^(propuesta|en proceso de inscripci)', 'propuesta');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_activities_milestones ON public.activities;
CREATE TRIGGER trg_activities_milestones AFTER INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.trg_milestones_on_activity();