-- Tablas para el módulo de Automatizaciones

CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'zap',
  enabled BOOLEAN NOT NULL DEFAULT false,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select automations" ON public.automations
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert automations" ON public.automations
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "tenant update automations" ON public.automations
  FOR UPDATE USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete automations" ON public.automations
  FOR DELETE USING (tenant_id = get_user_tenant(auth.uid()));

CREATE TRIGGER automations_set_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_automations_tenant ON public.automations(tenant_id);
CREATE INDEX idx_automations_enabled ON public.automations(tenant_id, enabled) WHERE enabled = true;

-- Historial de ejecuciones
CREATE TABLE public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  status TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'live',
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select automation_runs" ON public.automation_runs
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert automation_runs" ON public.automation_runs
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

CREATE INDEX idx_automation_runs_automation ON public.automation_runs(automation_id, created_at DESC);
CREATE INDEX idx_automation_runs_tenant ON public.automation_runs(tenant_id, created_at DESC);