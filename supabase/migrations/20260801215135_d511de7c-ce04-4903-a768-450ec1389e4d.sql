CREATE OR REPLACE FUNCTION public.trg_contact_lifecycle_from_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.is_won = true AND COALESCE(OLD.is_won, false) = false AND NEW.contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET status = 'cliente',
        updated_at = now()
    WHERE id = NEW.contact_id
      AND status NOT IN ('cliente');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_lifecycle_from_deal ON public.deals;
CREATE TRIGGER contact_lifecycle_from_deal
AFTER UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.trg_contact_lifecycle_from_deal();

ALTER TABLE public.contacts DROP COLUMN IF EXISTS stage_id;
DROP TABLE IF EXISTS public.contact_stages CASCADE;