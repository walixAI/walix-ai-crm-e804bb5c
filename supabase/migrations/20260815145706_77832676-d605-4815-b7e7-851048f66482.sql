ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS won_at timestamptz;

UPDATE public.deals SET won_at = updated_at WHERE is_won = true AND won_at IS NULL;

CREATE OR REPLACE FUNCTION public.deals_sync_won_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_won THEN
    IF NEW.won_at IS NULL THEN
      NEW.won_at := now();
    ELSIF NEW.won_at > now() THEN
      NEW.won_at := now();
    END IF;
  ELSE
    NEW.won_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_sync_won_at ON public.deals;
CREATE TRIGGER trg_deals_sync_won_at
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.deals_sync_won_at();