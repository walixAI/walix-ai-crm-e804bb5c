DO $do$
DECLARE
  r record;
  v_src text;
  v_guard text;
  v_param text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('suggest_goal_split','seed_pipeline_template','seed_default_deal_diagnostics','seed_default_activity_outcomes')
  LOOP
    v_src := pg_get_functiondef(r.oid);
    IF position('user_can_use_tenant' in v_src) > 0 THEN
      CONTINUE;
    END IF;
    v_param := CASE WHEN r.proname = 'seed_pipeline_template' THEN 'p_tenant_id' ELSE '_tenant_id' END;
    v_guard := E'\nBEGIN\n  IF NOT (public.user_can_use_tenant(auth.uid(), ' || v_param ||
               E') OR public.is_platform(auth.uid())) THEN\n    RAISE EXCEPTION ''not_authorized'' USING ERRCODE = ''insufficient_privilege'';\n  END IF;\n';
    v_src := overlay(v_src placing v_guard from position(E'\nBEGIN\n' in v_src) for length(E'\nBEGIN\n'));
    EXECUTE v_src;
  END LOOP;
END $do$;