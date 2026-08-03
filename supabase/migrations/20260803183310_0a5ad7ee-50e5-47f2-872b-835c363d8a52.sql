CREATE TABLE IF NOT EXISTS public.activity_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  activity_kind text,
  label text NOT NULL,
  moves_to_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  requires_next_action boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_outcomes TO authenticated;
GRANT ALL ON public.activity_outcomes TO service_role;

ALTER TABLE public.activity_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_outcomes_select" ON public.activity_outcomes
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "activity_outcomes_insert" ON public.activity_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "activity_outcomes_update" ON public.activity_outcomes
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "activity_outcomes_delete" ON public.activity_outcomes
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_activity_outcomes_tenant ON public.activity_outcomes(tenant_id, pipeline_id, stage_id);

CREATE TRIGGER activity_outcomes_set_updated_at
  BEFORE UPDATE ON public.activity_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.seed_default_activity_outcomes(_tenant_id uuid, _pipeline_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  nxt uuid;
  won uuid;
  lost uuid;
  inserted integer := 0;
BEGIN
  SELECT id INTO won FROM public.pipeline_stages
    WHERE pipeline_id = _pipeline_id AND is_won LIMIT 1;
  SELECT id INTO lost FROM public.pipeline_stages
    WHERE pipeline_id = _pipeline_id AND is_lost LIMIT 1;

  FOR s IN
    SELECT id, name, position, is_won, is_lost
    FROM public.pipeline_stages
    WHERE pipeline_id = _pipeline_id AND NOT is_won AND NOT is_lost
    ORDER BY position
  LOOP
    SELECT id INTO nxt FROM public.pipeline_stages
      WHERE pipeline_id = _pipeline_id AND NOT is_won AND NOT is_lost AND position > s.position
      ORDER BY position LIMIT 1;

    INSERT INTO public.activity_outcomes
      (tenant_id, pipeline_id, stage_id, label, moves_to_stage_id, requires_next_action, position)
    VALUES
      (_tenant_id, _pipeline_id, s.id, 'Contacto efectivo - avanza', COALESCE(nxt, won), true, 1),
      (_tenant_id, _pipeline_id, s.id, 'Contacto efectivo - sigue igual', NULL, true, 2),
      (_tenant_id, _pipeline_id, s.id, 'No contestó', NULL, true, 3),
      (_tenant_id, _pipeline_id, s.id, 'Reagendar', NULL, true, 4),
      (_tenant_id, _pipeline_id, s.id, 'Cerró / ganado', won, false, 5),
      (_tenant_id, _pipeline_id, s.id, 'No interesado', lost, false, 6);
    inserted := inserted + 6;
  END LOOP;

  RETURN inserted;
END;
$$;