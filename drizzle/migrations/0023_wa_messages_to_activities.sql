CREATE OR REPLACE FUNCTION public.trg_messages_to_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; v_deal uuid; who text; dir text; recent record; line text;
BEGIN
  SELECT contact_id, deal_id INTO c FROM conversations WHERE id = NEW.conversation_id;
  IF c.contact_id IS NULL OR COALESCE(NEW.body,'') = '' THEN RETURN NEW; END IF;
  v_deal := COALESCE(c.deal_id, public.open_deal_for_contact(c.contact_id));

  -- Notas del agente (handoff, resúmenes): actividad propia
  IF NEW.is_internal_note THEN
    IF NEW.metadata->>'kind' = 'agent_note' AND NEW.body LIKE '🤝%' THEN
      INSERT INTO activities (tenant_id, contact_id, deal_id, type, description, occurred_at, metadata)
      VALUES (NEW.tenant_id, c.contact_id, v_deal, 'note', left(NEW.body, 2000), now(),
              jsonb_build_object('auto', true, 'source', 'sales_agent', 'conversation_id', NEW.conversation_id));
    END IF;
    RETURN NEW;
  END IF;

  dir := CASE WHEN NEW.direction::text = 'inbound' THEN 'in' ELSE 'out' END;
  who := CASE WHEN dir = 'in' THEN 'Lead'
              WHEN NEW.metadata->>'bot' = 'true' THEN COALESCE(NEW.metadata->>'sales_agent_name','Agente IA')
              ELSE 'Asesor' END;
  line := who || ': ' || left(NEW.body, 300);

  -- Agrupa la conversación en un seguimiento por bloque de 30 minutos
  SELECT id, description INTO recent FROM activities
   WHERE contact_id = c.contact_id AND metadata->>'auto_wa' = 'true'
     AND metadata->>'conversation_id' = NEW.conversation_id::text
     AND occurred_at > now() - interval '30 minutes'
   ORDER BY occurred_at DESC LIMIT 1;

  IF recent.id IS NOT NULL THEN
    UPDATE activities SET description = right(COALESCE(recent.description,'') || E'\n' || line, 4000),
      updated_at = now(), deal_id = COALESCE(deal_id, v_deal)
     WHERE id = recent.id;
  ELSE
    INSERT INTO activities (tenant_id, contact_id, deal_id, type, description, occurred_at, metadata)
    VALUES (NEW.tenant_id, c.contact_id, v_deal,
            CASE WHEN dir = 'in' THEN 'wa_received'::activity_type ELSE 'wa_sent'::activity_type END,
            'Conversación por WhatsApp' || E'\n' || line, now(),
            jsonb_build_object('auto', true, 'auto_wa', true, 'direction', dir, 'conversation_id', NEW.conversation_id,
                               'by', who, 'activity_kind_label', CASE WHEN dir='in' THEN 'WhatsApp entrante' ELSE 'WhatsApp saliente' END));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_messages_activity ON public.messages;
CREATE TRIGGER trg_messages_activity AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.trg_messages_to_activity();

-- Correos entrantes/salientes también quedan como seguimiento
CREATE OR REPLACE FUNCTION public.trg_email_to_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record;
BEGIN
  SELECT contact_id, deal_id INTO t FROM email_threads WHERE id = NEW.thread_id;
  IF t.contact_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO activities (tenant_id, contact_id, deal_id, type, description, occurred_at, metadata)
  VALUES (NEW.tenant_id, t.contact_id, COALESCE(t.deal_id, public.open_deal_for_contact(t.contact_id)), 'email',
          CASE WHEN NEW.direction = 'inbound' THEN 'Correo recibido: ' ELSE 'Correo enviado: ' END || COALESCE(NEW.subject,'(sin asunto)'),
          now(), jsonb_build_object('auto', true, 'direction', CASE WHEN NEW.direction='inbound' THEN 'in' ELSE 'out' END, 'email_message_id', NEW.id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_email_activity ON public.email_messages;
CREATE TRIGGER trg_email_activity AFTER INSERT ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.trg_email_to_activity();