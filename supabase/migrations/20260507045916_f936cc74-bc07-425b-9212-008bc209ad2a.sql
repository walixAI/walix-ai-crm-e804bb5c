
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============= ai_agents =============
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  agent_type TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  schedule TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_actions_per_run INTEGER NOT NULL DEFAULT 10,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  actions_taken_today INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ DEFAULT now(),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agents_due ON public.ai_agents(is_active, next_run_at) WHERE is_active = true;
CREATE INDEX idx_ai_agents_tenant ON public.ai_agents(tenant_id);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select ai_agents" ON public.ai_agents
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid()));

CREATE POLICY "admin insert ai_agents" ON public.ai_agents
  FOR INSERT WITH CHECK (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
    )
  );

CREATE POLICY "admin update ai_agents" ON public.ai_agents
  FOR UPDATE USING (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
    )
  );

CREATE POLICY "admin delete ai_agents" ON public.ai_agents
  FOR DELETE USING (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))
    )
  );

CREATE TRIGGER trg_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ai_agent_runs =============
CREATE TABLE public.ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','partial')),
  entities_processed INTEGER NOT NULL DEFAULT 0,
  actions_taken INTEGER NOT NULL DEFAULT 0,
  suggestions_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  run_log JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_ai_agent_runs_agent ON public.ai_agent_runs(agent_id, started_at DESC);
CREATE INDEX idx_ai_agent_runs_tenant ON public.ai_agent_runs(tenant_id, started_at DESC);

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select ai_agent_runs" ON public.ai_agent_runs
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid()));

-- ============= Seed function for default agents =============
CREATE OR REPLACE FUNCTION public.seed_default_ai_agents(_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_agents (tenant_id, name, description, agent_type, system_prompt, schedule, model, allowed_tools, max_actions_per_run, next_run_at) VALUES
  (_tenant_id,
    'Guardián de Seguimientos',
    'Revisa cada mañana los deals activos y alerta sobre los que llevan más de 5 días sin actividad.',
    'followup_watchdog',
    'Eres el Guardián de Seguimientos de Walix. Tu objetivo: revisar deals activos sin actividad reciente y crear sugerencias proactivas concisas para el vendedor asignado. Sé directo. Una sugerencia por deal. No envíes WhatsApp.',
    '0 9 * * 1-5',
    'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','get_contact_context','create_task','create_proactive_suggestion'],
    20, now()),
  (_tenant_id,
    'Detector de Riesgo',
    'Cada tarde detecta deals en Propuesta/Negociación que muestren señales de enfriamiento.',
    'deal_risk_detector',
    'Eres el Detector de Riesgo. Analiza deals avanzados con señales de enfriamiento (urgencia alta, sentimiento negativo, fechas vencidas) y crea sugerencias de prioridad alta para el gerente. Sé conciso y específico.',
    '0 18 * * 1-5',
    'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','get_contact_context','create_proactive_suggestion'],
    10, now()),
  (_tenant_id,
    'Briefing Matutino',
    'Genera el briefing personalizado del día para cada vendedor activo.',
    'morning_briefing',
    'Eres el Briefing Matutino. Para el usuario indicado, genera 3 sugerencias top: la acción más importante del día, el deal que cierra esta semana más relevante, y el lead más caliente. Crea cada una como sugerencia proactiva con priority=10. Texto breve y accionable.',
    '30 7 * * 1-5',
    'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','search_contacts','get_contact_context','create_proactive_suggestion'],
    30, now()),
  (_tenant_id,
    'Coach Semanal',
    'Cada lunes analiza el rendimiento de la semana anterior y entrega coaching personalizado.',
    'weekly_coach',
    'Eres el Coach Semanal de ventas. Analiza datos de la semana anterior por vendedor, identifica patrones de éxito y entrega 1-2 recomendaciones concretas a cada vendedor. Crea sugerencias proactivas tipo coaching.',
    '0 8 * * 1',
    'google/gemini-2.5-pro',
    ARRAY['get_pipeline_status','search_contacts','create_proactive_suggestion'],
    15, now())
  ON CONFLICT DO NOTHING;
END;
$$;

-- Trigger to seed agents for new tenants
CREATE OR REPLACE FUNCTION public.trg_seed_ai_agents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_ai_agents(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_ai_agents_on_tenant_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_ai_agents();

-- Seed for existing tenants
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_ai_agents(t.id);
  END LOOP;
END $$;

-- ============= Dispatcher =============
CREATE OR REPLACE FUNCTION public.ai_run_due_agents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  service_key TEXT;
  edge_url TEXT := 'https://qomyfafowhuxuwbuubqk.supabase.co/functions/v1/ai-agent-runner';
  a RECORD;
  dispatched INTEGER := 0;
BEGIN
  service_key := current_setting('app.settings.service_role_key', true);
  IF service_key IS NULL OR service_key = '' THEN
    RAISE WARNING 'ai_run_due_agents: app.settings.service_role_key is not set; skipping dispatch';
    RETURN 0;
  END IF;

  FOR a IN
    SELECT id, tenant_id FROM public.ai_agents
    WHERE is_active = true AND next_run_at IS NOT NULL AND next_run_at <= now()
    LIMIT 50
  LOOP
    -- claim immediately to avoid double-dispatch
    UPDATE public.ai_agents SET next_run_at = NULL WHERE id = a.id;

    PERFORM extensions.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('agent_id', a.id, 'tenant_id', a.tenant_id)
    );
    dispatched := dispatched + 1;
  END LOOP;

  RETURN dispatched;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ai_run_due_agents error: %', SQLERRM;
  RETURN dispatched;
END;
$$;

-- Schedule via pg_cron (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('walix-agents-dispatcher');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'walix-agents-dispatcher',
  '*/5 * * * *',
  $$ SELECT public.ai_run_due_agents() $$
);
