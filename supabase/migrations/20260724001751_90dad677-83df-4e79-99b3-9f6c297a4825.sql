
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS closed_via TEXT,
  ADD COLUMN IF NOT EXISTS closed_note TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_closed_via_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_closed_via_check
  CHECK (closed_via IS NULL OR closed_via IN ('whatsapp','email','call','manual','auto','other'));
