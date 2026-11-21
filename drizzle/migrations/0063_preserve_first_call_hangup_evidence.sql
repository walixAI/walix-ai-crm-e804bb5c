CREATE OR REPLACE FUNCTION public.protect_call_hangup_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
  IF TG_OP = 'UPDATE' THEN
    IF OLD.hangup_by IS NOT NULL AND NEW.hangup_by IS NOT NULL THEN NEW.hangup_by := OLD.hangup_by; END IF;
    IF OLD.hangup_at IS NOT NULL AND NEW.hangup_at IS NOT NULL THEN NEW.hangup_at := OLD.hangup_at; END IF;
  END IF;
  RETURN NEW;
END;
$$;