CREATE TABLE public.call_analysis_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
 fingerprint text NOT NULL,
 status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','skipped','failed','unknown')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 UNIQUE(call_id,fingerprint)
);
GRANT ALL ON public.call_analysis_runs TO service_role;
REVOKE ALL ON public.call_analysis_runs FROM anon, authenticated;
ALTER TABLE public.call_analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_analysis_runs_service ON public.call_analysis_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX call_analysis_runs_active ON public.call_analysis_runs(call_id) WHERE status='processing';
CREATE OR REPLACE FUNCTION public.claim_call_analysis(p_call_id uuid,p_tenant_id uuid,p_fingerprint text,p_manual boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing public.call_analysis_runs; run_id uuid;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_fingerprint IS NULL OR length(p_fingerprint)>160 THEN RAISE EXCEPTION 'Invalid fingerprint'; END IF;
 PERFORM 1 FROM public.calls WHERE id=p_call_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Call unavailable'; END IF;
 IF p_manual THEN
  UPDATE public.call_analysis_runs SET status='unknown',finished_at=now() WHERE call_id=p_call_id AND tenant_id=p_tenant_id AND status='processing' AND created_at < now()-interval '10 minutes';
 END IF;
 SELECT * INTO existing FROM public.call_analysis_runs WHERE call_id=p_call_id AND status='processing' LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('state','processing'); END IF;
 SELECT * INTO existing FROM public.call_analysis_runs WHERE call_id=p_call_id AND fingerprint=p_fingerprint;
 IF FOUND THEN RETURN jsonb_build_object('state',existing.status); END IF;
 INSERT INTO public.call_analysis_runs(tenant_id,call_id,fingerprint) VALUES(p_tenant_id,p_call_id,p_fingerprint) RETURNING id INTO run_id;
 RETURN jsonb_build_object('state','claimed','id',run_id);
END $$;
REVOKE ALL ON FUNCTION public.claim_call_analysis(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_call_analysis(uuid,uuid,text,boolean) TO service_role;