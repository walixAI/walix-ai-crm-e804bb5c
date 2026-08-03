CREATE OR REPLACE FUNCTION public.pipeline_stage_impact(_stage_id uuid)
RETURNS TABLE(deals_count integer, outcomes_count integer, outcomes_targeting_count integer, rules_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.deals d WHERE d.stage_id = _stage_id),
    (SELECT count(*)::int FROM public.activity_outcomes o WHERE o.stage_id = _stage_id),
    (SELECT count(*)::int FROM public.activity_outcomes o WHERE o.moves_to_stage_id = _stage_id),
    (SELECT count(*)::int FROM public.pipeline_stage_rules r WHERE r.from_stage_id = _stage_id OR r.to_stage_id = _stage_id)
$$;

CREATE OR REPLACE FUNCTION public.delete_pipeline_stage(
  _stage_id uuid,
  _target_stage_id uuid DEFAULT NULL,
  _outcome_action text DEFAULT 'move'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage record;
  v_target record;
  v_deals int := 0;
  v_outcomes int := 0;
  v_rules_disabled int := 0;
BEGIN
  SELECT * INTO v_stage FROM public.pipeline_stages WHERE id = _stage_id;
  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'stage_not_found';
  END IF;

  IF NOT (
    public.has_tenant_role(auth.uid(), 'tenant_admin', v_stage.tenant_id)
    OR public.has_tenant_role(auth.uid(), 'tenant_owner', v_stage.tenant_id)
    OR public.has_tenant_role(auth.uid(), 'sales_manager', v_stage.tenant_id)
    OR public.is_platform(auth.uid())
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF _outcome_action NOT IN ('move', 'generalize', 'delete') THEN
    RAISE EXCEPTION 'invalid_outcome_action';
  END IF;

  IF _target_stage_id IS NOT NULL THEN
    IF _target_stage_id = _stage_id THEN
      RAISE EXCEPTION 'target_must_differ';
    END IF;
    SELECT * INTO v_target FROM public.pipeline_stages WHERE id = _target_stage_id;
    IF v_target IS NULL OR v_target.pipeline_id <> v_stage.pipeline_id THEN
      RAISE EXCEPTION 'invalid_target_stage';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.deals WHERE stage_id = _stage_id) AND v_target IS NULL THEN
    RAISE EXCEPTION 'target_stage_required';
  END IF;

  -- 1. Mover oportunidades
  IF v_target IS NOT NULL THEN
    WITH moved AS (
      UPDATE public.deals
      SET stage_id = v_target.id,
          stage_name = v_target.name,
          is_won = v_target.is_won,
          is_lost = v_target.is_lost,
          updated_at = now()
      WHERE stage_id = _stage_id
      RETURNING 1
    )
    SELECT count(*)::int INTO v_deals FROM moved;
  END IF;

  -- 2. Tipificaciones ligadas a la etapa
  IF _outcome_action = 'delete' OR v_target IS NULL THEN
    WITH del AS (
      DELETE FROM public.activity_outcomes WHERE stage_id = _stage_id RETURNING 1
    ) SELECT count(*)::int INTO v_outcomes FROM del;
  ELSIF _outcome_action = 'generalize' THEN
    WITH upd AS (
      UPDATE public.activity_outcomes SET stage_id = NULL WHERE stage_id = _stage_id RETURNING 1
    ) SELECT count(*)::int INTO v_outcomes FROM upd;
  ELSE
    WITH upd AS (
      UPDATE public.activity_outcomes SET stage_id = v_target.id WHERE stage_id = _stage_id RETURNING 1
    ) SELECT count(*)::int INTO v_outcomes FROM upd;
  END IF;

  -- 3. Tipificaciones que apuntaban a la etapa eliminada
  UPDATE public.activity_outcomes
  SET moves_to_stage_id = CASE WHEN v_target IS NULL THEN NULL ELSE v_target.id END
  WHERE moves_to_stage_id = _stage_id;

  -- Evitar auto-referencia
  UPDATE public.activity_outcomes
  SET moves_to_stage_id = NULL
  WHERE moves_to_stage_id IS NOT NULL AND moves_to_stage_id = stage_id;

  -- 4. Reglas de avance automático
  IF v_target IS NOT NULL THEN
    UPDATE public.pipeline_stage_rules SET from_stage_id = v_target.id WHERE from_stage_id = _stage_id;
    UPDATE public.pipeline_stage_rules SET to_stage_id = v_target.id WHERE to_stage_id = _stage_id;
    WITH dis AS (
      UPDATE public.pipeline_stage_rules
      SET is_active = false
      WHERE from_stage_id = to_stage_id AND is_active = true
      RETURNING 1
    ) SELECT count(*)::int INTO v_rules_disabled FROM dis;
  END IF;

  DELETE FROM public.pipeline_stages WHERE id = _stage_id;

  RETURN jsonb_build_object(
    'deals_moved', v_deals,
    'outcomes_affected', v_outcomes,
    'rules_disabled', v_rules_disabled,
    'outcome_action', _outcome_action
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pipeline_stage_impact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_pipeline_stage(uuid, uuid, text) TO authenticated;