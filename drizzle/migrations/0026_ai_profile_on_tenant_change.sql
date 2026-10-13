CREATE OR REPLACE FUNCTION public.seed_ai_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    INSERT INTO public.ai_user_profile(user_id, tenant_id)
    VALUES (NEW.id, NEW.tenant_id)
    ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_ai_user_profile_upd ON public.profiles;
CREATE TRIGGER trg_seed_ai_user_profile_upd AFTER UPDATE OF tenant_id ON public.profiles
  FOR EACH ROW WHEN (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) EXECUTE FUNCTION public.seed_ai_user_profile();
INSERT INTO public.ai_user_profile(user_id, tenant_id)
  SELECT p.id, p.tenant_id FROM public.profiles p WHERE p.tenant_id IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;