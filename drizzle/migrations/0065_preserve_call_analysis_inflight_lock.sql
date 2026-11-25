CREATE OR REPLACE FUNCTION public.claim_call_analysis(p_call_id uuid,p_tenant_id uuid,p_fingerprint text,p_manual boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing public.call_analysis_runs; run_id uuid;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_fingerprint IS NULL OR length(p_fingerprint)>160 THEN RAISE EXCEPTION 'Invalid fingerprint'; END IF;
 PERFORM 1 FROM public.calls WHERE id=p_call_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Call unavailable'; END IF;
 SELECT * INTO existing FROM public.call_analysis_runs WHERE call_id=p_call_id AND status='processing' LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('state','processing'); END IF;
 SELECT * INTO existing FROM public.call_analysis_runs WHERE call_id=p_call_id AND fingerprint=p_fingerprint;
 IF FOUND THEN RETURN jsonb_build_object('state',existing.status); END IF;
 INSERT INTO public.call_analysis_runs(tenant_id,call_id,fingerprint) VALUES(p_tenant_id,p_call_id,p_fingerprint) RETURNING id INTO run_id;
 RETURN jsonb_build_object('state','claimed','id',run_id);
END $$;
REVOKE ALL ON FUNCTION public.claim_call_analysis(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_call_analysis(uuid,uuid,text,boolean) TO service_role;