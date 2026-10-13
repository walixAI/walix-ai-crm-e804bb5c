CREATE OR REPLACE FUNCTION public.advance_deal_to_contacted(_deal_id uuid, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record; tgt record;
BEGIN
  SELECT dl.id, dl.is_won, dl.is_lost, s.pipeline_id, s.position INTO d
  FROM deals dl JOIN pipeline_stages s ON s.id = dl.stage_id WHERE dl.id = _deal_id;
  IF d IS NULL OR COALESCE(d.is_won,false) OR COALESCE(d.is_lost,false) THEN RETURN false; END IF;
  SELECT * INTO tgt FROM pipeline_stages
   WHERE pipeline_id = d.pipeline_id AND NOT COALESCE(is_won,false) AND NOT COALESCE(is_lost,false)
     AND lower(trim(name)) IN ('contactado','contactada','contacto establecido','contacto efectivo')
   ORDER BY position LIMIT 1;
  IF tgt IS NULL OR tgt.position <= d.position THEN RETURN false; END IF;
  PERFORM set_config('app.auto_stage_event', 'contacto:' || _reason, true);
  UPDATE deals SET stage_id = tgt.id, stage_name = tgt.name, updated_at = now() WHERE id = _deal_id;
  PERFORM set_config('app.auto_stage_event', '', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.open_deal_for_contact(_contact_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM deals WHERE contact_id = _contact_id AND NOT COALESCE(is_won,false) AND NOT COALESCE(is_lost,false)
  ORDER BY updated_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.trg_contacted_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; v uuid;
BEGIN
  IF NEW.direction::text <> 'inbound' THEN RETURN NEW; END IF;
  SELECT contact_id, deal_id INTO c FROM conversations WHERE id = NEW.conversation_id;
  v := COALESCE(c.deal_id, public.open_deal_for_contact(c.contact_id));
  IF v IS NOT NULL THEN PERFORM public.advance_deal_to_contacted(v, 'whatsapp'); END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_contacted_on_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; v uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  SELECT contact_id, deal_id INTO t FROM email_threads WHERE id = NEW.thread_id;
  v := COALESCE(t.deal_id, public.open_deal_for_contact(t.contact_id));
  IF v IS NOT NULL THEN PERFORM public.advance_deal_to_contacted(v, 'email'); END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_contacted_on_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid; res text;
BEGIN
  res := lower(COALESCE(NEW.metadata->>'result', NEW.metadata->>'outcome', ''));
  -- Hubo contacto: respuesta entrante o tipificación que no sea un intento fallido
  IF NOT (NEW.metadata->>'direction' = 'in' OR NEW.type::text IN ('wa_received','email_received')
     OR ((NEW.metadata ? 'outcome_id' OR res <> '')
         AND res !~ '(no contest|buz[oó]n|sin respuesta|no respond|equivocad|apagad|no disponible|no localiz|intento)')) THEN
    RETURN NEW;
  END IF;
  v := COALESCE(NEW.deal_id, public.open_deal_for_contact(NEW.contact_id));
  IF v IS NOT NULL THEN PERFORM public.advance_deal_to_contacted(v, 'tipificacion'); END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_messages_contacted ON public.messages;
CREATE TRIGGER trg_messages_contacted AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.trg_contacted_on_message();
DROP TRIGGER IF EXISTS trg_email_contacted ON public.email_messages;
CREATE TRIGGER trg_email_contacted AFTER INSERT ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.trg_contacted_on_email();
DROP TRIGGER IF EXISTS trg_activities_contacted ON public.activities;
CREATE TRIGGER trg_activities_contacted AFTER INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.trg_contacted_on_activity();

REVOKE EXECUTE ON FUNCTION public.advance_deal_to_contacted(uuid,text) FROM anon, authenticated, public;