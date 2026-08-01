-- 1. Add metadata column to deal_stage_history to track automatic moves
ALTER TABLE public.deal_stage_history ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Create enum for trigger events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_stage_trigger_event') THEN
    CREATE TYPE public.pipeline_stage_trigger_event AS ENUM (
      'message_received',
      'payment_received',
      'activity_completed',
      'task_completed'
    );
  END IF;
END $$;

-- 3. Create pipeline_stage_rules table
CREATE TABLE IF NOT EXISTS public.pipeline_stage_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  from_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  to_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  trigger_event public.pipeline_stage_trigger_event NOT NULL,
  trigger_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Grants and RLS for pipeline_stage_rules
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stage_rules TO authenticated;
GRANT ALL ON public.pipeline_stage_rules TO service_role;

ALTER TABLE public.pipeline_stage_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage rules in their tenant"
ON public.pipeline_stage_rules
FOR ALL
TO authenticated
USING (tenant_id IN (SELECT active_tenant_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT active_tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Core function: apply automatic stage rules for a deal
CREATE OR REPLACE FUNCTION public.apply_pipeline_stage_rules(
  p_deal_id uuid,
  p_event_type public.pipeline_stage_trigger_event,
  p_event_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_rule record;
  v_to_stage record;
BEGIN
  SELECT d.id, d.tenant_id, d.stage_id, d.is_won, d.is_lost, ps.pipeline_id
  INTO v_deal
  FROM public.deals d
  JOIN public.pipeline_stages ps ON ps.id = d.stage_id
  WHERE d.id = p_deal_id;

  IF v_deal IS NULL OR COALESCE(v_deal.is_won, false) OR COALESCE(v_deal.is_lost, false) THEN
    RETURN false;
  END IF;

  SELECT r.* INTO v_rule
  FROM public.pipeline_stage_rules r
  WHERE r.tenant_id = v_deal.tenant_id
    AND r.pipeline_id = v_deal.pipeline_id
    AND r.from_stage_id = v_deal.stage_id
    AND r.trigger_event = p_event_type
    AND r.is_active = true
    AND (r.trigger_filters = '{}'::jsonb OR r.trigger_filters @> p_event_filters)
  ORDER BY r.created_at
  LIMIT 1;

  IF v_rule IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_to_stage FROM public.pipeline_stages WHERE id = v_rule.to_stage_id;
  IF v_to_stage IS NULL THEN
    RETURN false;
  END IF;

  -- Mark this update as automatic so log_deal_stage_change records metadata
  PERFORM set_config('app.auto_stage_rule_id', v_rule.id::text, true);
  PERFORM set_config('app.auto_stage_event', p_event_type::text, true);

  UPDATE public.deals
  SET stage_id = v_to_stage.id,
      stage_name = v_to_stage.name,
      is_won = v_to_stage.is_won,
      is_lost = v_to_stage.is_lost,
      updated_at = now()
  WHERE id = p_deal_id;

  -- Clear session variables
  PERFORM set_config('app.auto_stage_rule_id', '', true);
  PERFORM set_config('app.auto_stage_event', '', true);

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.auto_stage_rule_id', '', true);
  PERFORM set_config('app.auto_stage_event', '', true);
  RAISE;
END;
$$;

-- 6. Update deal_stage_history trigger to capture automatic move metadata
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_id text;
  v_event text;
  v_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_stage_history (
      tenant_id, deal_id, from_stage_id, to_stage_id,
      from_stage_name, to_stage_name, changed_by, metadata
    ) VALUES (
      NEW.tenant_id, NEW.id, NULL, NEW.stage_id,
      NULL, NEW.stage_name, auth.uid(), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    v_rule_id := current_setting('app.auto_stage_rule_id', true);
    v_event := current_setting('app.auto_stage_event', true);

    IF v_rule_id IS NOT NULL AND v_rule_id <> '' THEN
      v_metadata := jsonb_build_object(
        'automatic', true,
        'rule_id', v_rule_id,
        'event', v_event
      );
    ELSE
      v_metadata := NULL;
    END IF;

    INSERT INTO public.deal_stage_history (
      tenant_id, deal_id, from_stage_id, to_stage_id,
      from_stage_name, to_stage_name, changed_by, metadata
    ) VALUES (
      NEW.tenant_id, NEW.id, OLD.stage_id, NEW.stage_id,
      OLD.stage_name, NEW.stage_name, auth.uid(), v_metadata
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Trigger: activities -> automatic stage rules
CREATE OR REPLACE FUNCTION public.trg_apply_stage_rules_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    PERFORM public.apply_pipeline_stage_rules(
      NEW.deal_id,
      'activity_completed',
      jsonb_build_object(
        'activity_type', NEW.type::text,
        'outcome', COALESCE(NEW.metadata->>'outcome', '')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_stage_rules_on_activity ON public.activities;
CREATE TRIGGER apply_stage_rules_on_activity
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_stage_rules_on_activity();

-- 8. Trigger: tasks completed -> automatic stage rules
CREATE OR REPLACE FUNCTION public.trg_apply_stage_rules_on_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.completed IS DISTINCT FROM NEW.completed AND NEW.completed = true AND NEW.deal_id IS NOT NULL THEN
    PERFORM public.apply_pipeline_stage_rules(
      NEW.deal_id,
      'task_completed',
      jsonb_build_object(
        'task_kind', COALESCE(NEW.task_kind, ''),
        'closed_via', COALESCE(NEW.closed_via, '')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_stage_rules_on_task ON public.tasks;
CREATE TRIGGER apply_stage_rules_on_task
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_stage_rules_on_task();

-- 9. Trigger: inbound messages -> automatic stage rules
CREATE OR REPLACE FUNCTION public.trg_apply_stage_rules_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_deal_id uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;

  SELECT contact_id, deal_id INTO v_contact_id, v_deal_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_deal_id IS NULL AND v_contact_id IS NOT NULL THEN
    SELECT id INTO v_deal_id
    FROM public.deals
    WHERE contact_id = v_contact_id
      AND COALESCE(is_won, false) = false
      AND COALESCE(is_lost, false) = false
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  IF v_deal_id IS NOT NULL THEN
    PERFORM public.apply_pipeline_stage_rules(
      v_deal_id,
      'message_received',
      jsonb_build_object(
        'channel', COALESCE(NEW.type::text, 'text'),
        'direction', NEW.direction::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_stage_rules_on_message ON public.messages;
CREATE TRIGGER apply_stage_rules_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_stage_rules_on_message();

-- 10. Trigger: full payment -> automatic stage rules
CREATE OR REPLACE FUNCTION public.trg_apply_stage_rules_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF COALESCE(NEW.amount_paid, 0) >= COALESCE(NEW.amount, 0) AND NEW.payment_status = 'paid' THEN
      PERFORM public.apply_pipeline_stage_rules(NEW.id, 'payment_received', '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_stage_rules_on_payment ON public.deals;
CREATE TRIGGER apply_stage_rules_on_payment
AFTER UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_stage_rules_on_payment();

-- 11. Function to seed a pipeline from a template
CREATE OR REPLACE FUNCTION public.seed_pipeline_template(
  p_tenant_id uuid,
  p_pipeline_id uuid,
  p_template_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_new uuid;
  v_stage_contacted uuid;
  v_stage_quote uuid;
  v_stage_negotiation uuid;
  v_stage_won uuid;
  v_stage_lost uuid;
  v_stage_request uuid;
  v_stage_scheduled uuid;
  v_stage_visit uuid;
  v_stage_completed uuid;
  v_stage_no_apply uuid;
  v_stage_inquiry uuid;
  v_stage_confirmed uuid;
  v_stage_delivered uuid;
  v_stage_cancelled uuid;
  v_stage_to_renew uuid;
  v_stage_sent uuid;
BEGIN
  -- Clean existing stages and rules for this pipeline
  DELETE FROM public.pipeline_stage_rules WHERE pipeline_id = p_pipeline_id;
  DELETE FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id;

  IF p_template_name = 'ventas' THEN
    INSERT INTO public.pipeline_stages (tenant_id, pipeline_id, name, color, position, is_won, is_lost)
    VALUES
      (p_tenant_id, p_pipeline_id, 'Nuevo', 'hsl(220 13% 65%)', 0, false, false),
      (p_tenant_id, p_pipeline_id, 'Contactado', 'hsl(200 80% 55%)', 1, false, false),
      (p_tenant_id, p_pipeline_id, 'Cotización', 'hsl(45 90% 55%)', 2, false, false),
      (p_tenant_id, p_pipeline_id, 'Negociación', 'hsl(280 70% 55%)', 3, false, false),
      (p_tenant_id, p_pipeline_id, 'Cerrado Ganado', 'hsl(142 76% 36%)', 4, true, false),
      (p_tenant_id, p_pipeline_id, 'Cerrado Perdido', 'hsl(0 72% 51%)', 5, false, true);

    SELECT id INTO v_stage_new FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Nuevo';
    SELECT id INTO v_stage_contacted FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Contactado';
    SELECT id INTO v_stage_quote FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Cotización';
    SELECT id INTO v_stage_negotiation FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Negociación';
    SELECT id INTO v_stage_won FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Cerrado Ganado';
    SELECT id INTO v_stage_lost FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Cerrado Perdido';

    INSERT INTO public.pipeline_stage_rules (tenant_id, pipeline_id, from_stage_id, to_stage_id, trigger_event, trigger_filters)
    VALUES
      (p_tenant_id, p_pipeline_id, v_stage_new, v_stage_contacted, 'message_received', '{}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_quote, v_stage_negotiation, 'activity_completed', '{"activity_type":"meeting","outcome":"effective"}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_quote, v_stage_won, 'payment_received', '{}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_negotiation, v_stage_won, 'payment_received', '{}'::jsonb);

  ELSIF p_template_name = 'mantenimiento' THEN
    INSERT INTO public.pipeline_stages (tenant_id, pipeline_id, name, color, position, is_won, is_lost)
    VALUES
      (p_tenant_id, p_pipeline_id, 'Solicitud', 'hsl(220 13% 65%)', 0, false, false),
      (p_tenant_id, p_pipeline_id, 'Programado', 'hsl(200 80% 55%)', 1, false, false),
      (p_tenant_id, p_pipeline_id, 'En visita', 'hsl(45 90% 55%)', 2, false, false),
      (p_tenant_id, p_pipeline_id, 'Completado', 'hsl(142 76% 36%)', 3, true, false),
      (p_tenant_id, p_pipeline_id, 'No aplica', 'hsl(0 72% 51%)', 4, false, true);

    SELECT id INTO v_stage_request FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Solicitud';
    SELECT id INTO v_stage_scheduled FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Programado';
    SELECT id INTO v_stage_visit FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'En visita';
    SELECT id INTO v_stage_completed FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Completado';
    SELECT id INTO v_stage_no_apply FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'No aplica';

    INSERT INTO public.pipeline_stage_rules (tenant_id, pipeline_id, from_stage_id, to_stage_id, trigger_event, trigger_filters)
    VALUES
      (p_tenant_id, p_pipeline_id, v_stage_request, v_stage_scheduled, 'activity_completed', '{"activity_type":"call","outcome":"scheduled"}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_scheduled, v_stage_visit, 'activity_completed', '{"activity_type":"manual","outcome":"started"}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_visit, v_stage_completed, 'task_completed', '{"task_kind":"maintenance","closed_via":"completed"}'::jsonb);

  ELSIF p_template_name = 'refacciones' THEN
    INSERT INTO public.pipeline_stages (tenant_id, pipeline_id, name, color, position, is_won, is_lost)
    VALUES
      (p_tenant_id, p_pipeline_id, 'Consulta', 'hsl(220 13% 65%)', 0, false, false),
      (p_tenant_id, p_pipeline_id, 'Cotización', 'hsl(200 80% 55%)', 1, false, false),
      (p_tenant_id, p_pipeline_id, 'Pedido confirmado', 'hsl(45 90% 55%)', 2, false, false),
      (p_tenant_id, p_pipeline_id, 'Entregado', 'hsl(142 76% 36%)', 3, true, false),
      (p_tenant_id, p_pipeline_id, 'Cancelado', 'hsl(0 72% 51%)', 4, false, true);

    SELECT id INTO v_stage_inquiry FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Consulta';
    SELECT id INTO v_stage_quote FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Cotización';
    SELECT id INTO v_stage_confirmed FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Pedido confirmado';
    SELECT id INTO v_stage_delivered FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Entregado';
    SELECT id INTO v_stage_cancelled FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Cancelado';

    INSERT INTO public.pipeline_stage_rules (tenant_id, pipeline_id, from_stage_id, to_stage_id, trigger_event, trigger_filters)
    VALUES
      (p_tenant_id, p_pipeline_id, v_stage_inquiry, v_stage_quote, 'message_received', '{}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_quote, v_stage_confirmed, 'activity_completed', '{"activity_type":"call","outcome":"effective"}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_confirmed, v_stage_delivered, 'payment_received', '{}'::jsonb);

  ELSIF p_template_name = 'renovaciones' THEN
    INSERT INTO public.pipeline_stages (tenant_id, pipeline_id, name, color, position, is_won, is_lost)
    VALUES
      (p_tenant_id, p_pipeline_id, 'Por renovar', 'hsl(220 13% 65%)', 0, false, false),
      (p_tenant_id, p_pipeline_id, 'Contactado', 'hsl(200 80% 55%)', 1, false, false),
      (p_tenant_id, p_pipeline_id, 'Cotización enviada', 'hsl(45 90% 55%)', 2, false, false),
      (p_tenant_id, p_pipeline_id, 'Renovado', 'hsl(142 76% 36%)', 3, true, false),
      (p_tenant_id, p_pipeline_id, 'No renovó', 'hsl(0 72% 51%)', 4, false, true);

    SELECT id INTO v_stage_to_renew FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Por renovar';
    SELECT id INTO v_stage_contacted FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Contactado';
    SELECT id INTO v_stage_sent FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Cotización enviada';
    SELECT id INTO v_stage_won FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'Renovado';
    SELECT id INTO v_stage_lost FROM public.pipeline_stages WHERE pipeline_id = p_pipeline_id AND name = 'No renovó';

    INSERT INTO public.pipeline_stage_rules (tenant_id, pipeline_id, from_stage_id, to_stage_id, trigger_event, trigger_filters)
    VALUES
      (p_tenant_id, p_pipeline_id, v_stage_to_renew, v_stage_contacted, 'message_received', '{}'::jsonb),
      (p_tenant_id, p_pipeline_id, v_stage_sent, v_stage_won, 'payment_received', '{}'::jsonb);
  END IF;
END;
$$;

-- 12. updated_at trigger for pipeline_stage_rules
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_pipeline_stage_rules_updated_at ON public.pipeline_stage_rules;
CREATE TRIGGER set_pipeline_stage_rules_updated_at
BEFORE UPDATE ON public.pipeline_stage_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();