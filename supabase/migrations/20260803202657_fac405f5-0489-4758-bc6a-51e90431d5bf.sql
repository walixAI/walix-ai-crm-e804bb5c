ALTER TABLE public.activity_outcomes
  ADD COLUMN IF NOT EXISTS stage_behavior text NOT NULL DEFAULT 'stay',
  ADD COLUMN IF NOT EXISTS is_won boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lost boolean NOT NULL DEFAULT false;

ALTER TABLE public.activity_outcomes
  DROP CONSTRAINT IF EXISTS activity_outcomes_stage_behavior_check;

ALTER TABLE public.activity_outcomes
  ADD CONSTRAINT activity_outcomes_stage_behavior_check
  CHECK (stage_behavior IN ('advance','suggest','stay'));

UPDATE public.activity_outcomes
SET stage_behavior = 'suggest'
WHERE moves_to_stage_id IS NOT NULL;