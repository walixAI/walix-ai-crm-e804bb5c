
CREATE TABLE public.copilot_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'recipe' CHECK (kind IN ('recipe','native')),
  recipe_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  trigger_phrases text[] NOT NULL DEFAULT ARRAY[]::text[],
  scope_type text NOT NULL DEFAULT 'all' CHECK (scope_type IN ('all','role','user')),
  scope_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  scope_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  channels text[] NOT NULL DEFAULT ARRAY['web']::text[],
  require_confirmation boolean NOT NULL DEFAULT true,
  daily_limit integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_capabilities_tenant ON public.copilot_capabilities(tenant_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_capabilities TO authenticated;
GRANT ALL ON public.copilot_capabilities TO service_role;

ALTER TABLE public.copilot_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read capabilities"
  ON public.copilot_capabilities FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "tenant admins manage capabilities"
  ON public.copilot_capabilities FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner') OR public.is_platform(auth.uid()))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner') OR public.is_platform(auth.uid()))
  );

CREATE TRIGGER trg_copilot_caps_updated
  BEFORE UPDATE ON public.copilot_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.copilot_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  capability_id uuid REFERENCES public.copilot_capabilities(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  step_index integer,
  step_name text,
  input jsonb,
  output jsonb,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','dry_run')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_copilot_action_log_tenant ON public.copilot_action_log(tenant_id, created_at DESC);

GRANT SELECT, INSERT ON public.copilot_action_log TO authenticated;
GRANT ALL ON public.copilot_action_log TO service_role;

ALTER TABLE public.copilot_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant admins read action log"
  ON public.copilot_action_log FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner') OR public.is_platform(auth.uid()))
  );

CREATE POLICY "service inserts action log"
  ON public.copilot_action_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
