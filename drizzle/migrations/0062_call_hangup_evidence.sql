ALTER TABLE public.calls ADD COLUMN hangup_by text, ADD COLUMN hangup_at timestamptz;
ALTER TABLE public.calls ADD CONSTRAINT calls_hangup_by_check CHECK (hangup_by IS NULL OR hangup_by IN ('prospect','agent','system'));
COMMENT ON COLUMN public.calls.hangup_by IS 'Evidence-based termination initiator; NULL when provider cannot identify who ended the call. Not inferred from completed status or callback arrival order.';
COMMENT ON COLUMN public.calls.hangup_at IS 'Time of observed termination or authenticated hangup action; historical calls remain NULL.';
GRANT SELECT (hangup_by, hangup_at) ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
CREATE FUNCTION public.protect_call_hangup_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() IN ('anon','authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.hangup_by IS NOT NULL OR NEW.hangup_at IS NOT NULL THEN
        RAISE EXCEPTION 'Call termination evidence is service-managed' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.hangup_by IS DISTINCT FROM OLD.hangup_by OR NEW.hangup_at IS DISTINCT FROM OLD.hangup_at THEN
      RAISE EXCEPTION 'Call termination evidence is service-managed' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_call_hangup_evidence BEFORE INSERT OR UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.protect_call_hangup_evidence();