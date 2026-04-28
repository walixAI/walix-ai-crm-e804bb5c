
-- Add columns to pipeline_stages for color and terminal flags
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'hsl(220 13% 65%)',
  ADD COLUMN IF NOT EXISTS is_won boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lost boolean NOT NULL DEFAULT false;

-- Add notes + source columns to deals (referenced by drawer)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS source public.lead_source NOT NULL DEFAULT 'Manual';

-- Add deal_id to ai_suggestions so suggestions can be deal-specific
ALTER TABLE public.ai_suggestions
  ADD COLUMN IF NOT EXISTS deal_id uuid;

-- updated_at trigger for deals (used by daysInStage)
DROP TRIGGER IF EXISTS deals_set_updated_at ON public.deals;
CREATE TRIGGER deals_set_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
