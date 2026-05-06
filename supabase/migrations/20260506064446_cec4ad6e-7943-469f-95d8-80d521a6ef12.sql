
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-MX',
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS wa_greeting text,
  ADD COLUMN IF NOT EXISTS reminder_hour smallint NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"task_reminders":true,"deal_updates":true,"mentions":true,"ai_suggestions":true}'::jsonb;
