-- 1. Tabla pipelines
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select pipelines" ON public.pipelines FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "tenant insert pipelines" ON public.pipelines FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "tenant update pipelines" ON public.pipelines FOR UPDATE
  USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete pipelines" ON public.pipelines FOR DELETE
  USING (tenant_id = get_user_tenant(auth.uid()));

-- 2. Backfill: crear un pipeline default por tenant que ya tiene stages
INSERT INTO public.pipelines (tenant_id, name, is_default, position)
SELECT DISTINCT tenant_id, 'Pipeline Principal', true, 0
FROM public.pipeline_stages
ON CONFLICT DO NOTHING;

-- 3. Añadir pipeline_id a pipeline_stages y vincular al default
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS pipeline_id uuid;

UPDATE public.pipeline_stages s
SET pipeline_id = p.id
FROM public.pipelines p
WHERE p.tenant_id = s.tenant_id
  AND p.is_default = true
  AND s.pipeline_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON public.pipeline_stages(pipeline_id);

-- 4. Tabla deal_stage_history
CREATE TABLE public.deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  from_stage_id uuid,
  to_stage_id uuid,
  from_stage_name text,
  to_stage_name text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_stage_history_deal ON public.deal_stage_history(deal_id, changed_at DESC);

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select deal_stage_history" ON public.deal_stage_history FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "tenant insert deal_stage_history" ON public.deal_stage_history FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- 5. Trigger function para registrar cambios de etapa
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_stage_history (
      tenant_id, deal_id, from_stage_id, to_stage_id,
      from_stage_name, to_stage_name, changed_by
    ) VALUES (
      NEW.tenant_id, NEW.id, NULL, NEW.stage_id,
      NULL, NEW.stage_name, auth.uid()
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.deal_stage_history (
      tenant_id, deal_id, from_stage_id, to_stage_id,
      from_stage_name, to_stage_name, changed_by
    ) VALUES (
      NEW.tenant_id, NEW.id, OLD.stage_id, NEW.stage_id,
      OLD.stage_name, NEW.stage_name, auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_deal_stage_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_deal_stage_history
AFTER INSERT OR UPDATE OF stage_id ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.log_deal_stage_change();

-- 6. Backfill historial para deals existentes (un row inicial por deal)
INSERT INTO public.deal_stage_history (tenant_id, deal_id, to_stage_id, to_stage_name, changed_at)
SELECT tenant_id, id, stage_id, stage_name, created_at
FROM public.deals
WHERE stage_id IS NOT NULL;