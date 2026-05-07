
-- ────────── ai_outcome_feedback ──────────
CREATE TABLE public.ai_outcome_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  suggestion_id UUID REFERENCES public.ai_proactive_suggestions(id) ON DELETE SET NULL,
  action_taken TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  outcome TEXT,
  outcome_value NUMERIC NOT NULL DEFAULT 0,
  days_to_outcome INTEGER,
  context_at_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_outcome_feedback_tenant_created
  ON public.ai_outcome_feedback (tenant_id, created_at DESC);
CREATE INDEX idx_ai_outcome_feedback_tenant_outcome
  ON public.ai_outcome_feedback (tenant_id, outcome);
CREATE INDEX idx_ai_outcome_feedback_suggestion
  ON public.ai_outcome_feedback (suggestion_id);

ALTER TABLE public.ai_outcome_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select ai_outcome_feedback"
  ON public.ai_outcome_feedback FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

CREATE POLICY "tenant insert ai_outcome_feedback"
  ON public.ai_outcome_feedback FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_outcome_feedback;

-- ────────── ai_tenant_patterns ──────────
CREATE TABLE public.ai_tenant_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pattern_type)
);

CREATE INDEX idx_ai_tenant_patterns_tenant ON public.ai_tenant_patterns (tenant_id);

ALTER TABLE public.ai_tenant_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select ai_tenant_patterns"
  ON public.ai_tenant_patterns FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

CREATE TRIGGER trg_ai_tenant_patterns_updated
  BEFORE UPDATE ON public.ai_tenant_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_tenant_patterns;

-- ────────── Helper: latest acted-on suggestion for an entity ──────────
CREATE OR REPLACE FUNCTION public.recent_acted_suggestion(_tenant_id uuid, _entity_type text, _entity_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.ai_proactive_suggestions
  WHERE tenant_id = _tenant_id
    AND entity_type = _entity_type
    AND entity_id = _entity_id
    AND acted_on = true
    AND created_at >= (now() - interval '7 days')
  ORDER BY created_at DESC LIMIT 1
$$;

-- ────────── Trigger: deals → outcome ──────────
CREATE OR REPLACE FUNCTION public.trg_deals_outcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sug uuid;
  v_outcome text;
  v_value numeric := 0;
  v_days int;
BEGIN
  IF NEW.is_won = true AND COALESCE(OLD.is_won, false) = false THEN
    v_outcome := 'deal_closed'; v_value := COALESCE(NEW.amount, 0);
  ELSIF NEW.is_lost = true AND COALESCE(OLD.is_lost, false) = false THEN
    v_outcome := 'deal_lost';
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND COALESCE(NEW.is_won,false)=false AND COALESCE(NEW.is_lost,false)=false THEN
    v_outcome := 'deal_advanced';
  ELSE
    RETURN NEW;
  END IF;

  sug := public.recent_acted_suggestion(NEW.tenant_id, 'deal', NEW.id);
  IF sug IS NULL THEN RETURN NEW; END IF;

  v_days := GREATEST(0, EXTRACT(DAY FROM (now() - (SELECT created_at FROM public.ai_proactive_suggestions WHERE id = sug)))::int);

  INSERT INTO public.ai_outcome_feedback
    (tenant_id, suggestion_id, action_taken, entity_type, entity_id, outcome, outcome_value, days_to_outcome, context_at_action)
  VALUES
    (NEW.tenant_id, sug, COALESCE(TG_OP, 'UPDATE'), 'deal', NEW.id, v_outcome, v_value, v_days,
     jsonb_build_object('stage_name', NEW.stage_name, 'owner_id', NEW.owner_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deals_outcome
  AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_deals_outcome();

-- ────────── Trigger: messages → contact_responded ──────────
CREATE OR REPLACE FUNCTION public.trg_messages_outcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  conv RECORD;
  recent_outbound timestamptz;
  sug uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;

  SELECT contact_id INTO conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF conv.contact_id IS NULL THEN RETURN NEW; END IF;

  SELECT MAX(sent_at) INTO recent_outbound
  FROM public.messages
  WHERE conversation_id = NEW.conversation_id
    AND direction = 'outbound'
    AND sent_at >= (now() - interval '24 hours');
  IF recent_outbound IS NULL THEN RETURN NEW; END IF;

  sug := public.recent_acted_suggestion(NEW.tenant_id, 'contact', conv.contact_id);
  IF sug IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.ai_outcome_feedback
    (tenant_id, suggestion_id, action_taken, entity_type, entity_id, outcome, outcome_value, days_to_outcome, context_at_action)
  VALUES
    (NEW.tenant_id, sug, 'whatsapp_reply', 'contact', conv.contact_id, 'contact_responded', 0,
     GREATEST(0, EXTRACT(EPOCH FROM (now() - recent_outbound))/86400)::int,
     jsonb_build_object('conversation_id', NEW.conversation_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_outcome
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_messages_outcome();

-- ────────── Seed Aprendiz agent in default seed function ──────────
CREATE OR REPLACE FUNCTION public.seed_default_ai_agents(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.ai_agents (tenant_id, name, description, agent_type, system_prompt, schedule, model, allowed_tools, max_actions_per_run, next_run_at) VALUES
  (_tenant_id, 'Guardián de Seguimientos',
    'Revisa cada mañana los deals activos y alerta sobre los que llevan más de 5 días sin actividad.',
    'followup_watchdog',
    'Eres el Guardián de Seguimientos de Walix. Tu objetivo: revisar deals activos sin actividad reciente y crear sugerencias proactivas concisas para el vendedor asignado. Sé directo. Una sugerencia por deal. No envíes WhatsApp.',
    '0 9 * * 1-5', 'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','get_contact_context','create_task','create_proactive_suggestion'],
    20, now()),
  (_tenant_id, 'Detector de Riesgo',
    'Cada tarde detecta deals en Propuesta/Negociación que muestren señales de enfriamiento.',
    'deal_risk_detector',
    'Eres el Detector de Riesgo. Analiza deals avanzados con señales de enfriamiento y crea sugerencias de prioridad alta para el gerente.',
    '0 18 * * 1-5', 'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','get_contact_context','create_proactive_suggestion'],
    10, now()),
  (_tenant_id, 'Briefing Matutino',
    'Genera el briefing personalizado del día para cada vendedor activo.',
    'morning_briefing',
    'Eres el Briefing Matutino. Para el usuario indicado, genera 3 sugerencias top con priority=10. Texto breve y accionable.',
    '30 7 * * 1-5', 'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','search_contacts','get_contact_context','create_proactive_suggestion'],
    30, now()),
  (_tenant_id, 'Coach Semanal',
    'Cada lunes analiza el rendimiento de la semana anterior y entrega coaching personalizado.',
    'weekly_coach',
    'Eres el Coach Semanal de ventas. Analiza datos de la semana anterior por vendedor y entrega 1-2 recomendaciones concretas.',
    '0 8 * * 1', 'google/gemini-2.5-pro',
    ARRAY['get_pipeline_status','search_contacts','create_proactive_suggestion'],
    15, now()),
  (_tenant_id, 'Aprendiz',
    'Cada domingo analiza los resultados de la última semana y aprende patrones específicos de tu negocio.',
    'aprendiz',
    'Eres el Aprendiz de Walix. Recibes agregados de outcomes reales de la última semana. Tu trabajo: detectar patrones (mejor día de seguimiento, horas pico de respuesta, objeciones más comunes, tiempo promedio de cierre, vendedores estrella) y guardarlos llamando update_tenant_pattern. Asigna confidence_score entre 0 y 1 según el tamaño de muestra (≥50: alta, ≥20: media, <20: baja).',
    '0 3 * * 0', 'google/gemini-2.5-flash',
    ARRAY['update_tenant_pattern'],
    10, now())
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Backfill Aprendiz for existing tenants
INSERT INTO public.ai_agents (tenant_id, name, description, agent_type, system_prompt, schedule, model, allowed_tools, max_actions_per_run, next_run_at)
SELECT t.id, 'Aprendiz',
  'Cada domingo analiza los resultados de la última semana y aprende patrones específicos de tu negocio.',
  'aprendiz',
  'Eres el Aprendiz de Walix. Recibes agregados de outcomes reales de la última semana. Tu trabajo: detectar patrones (mejor día de seguimiento, horas pico de respuesta, objeciones más comunes, tiempo promedio de cierre, vendedores estrella) y guardarlos llamando update_tenant_pattern. Asigna confidence_score entre 0 y 1 según el tamaño de muestra (≥50: alta, ≥20: media, <20: baja).',
  '0 3 * * 0', 'google/gemini-2.5-flash',
  ARRAY['update_tenant_pattern'], 10, now()
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents a WHERE a.tenant_id = t.id AND a.agent_type = 'aprendiz'
);
