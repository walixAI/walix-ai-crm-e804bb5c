ALTER TABLE public.sales_agents
  ADD COLUMN IF NOT EXISTS out_of_scope text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profiling_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profiling_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS format_rules jsonb NOT NULL DEFAULT '{"max_chars":300,"max_emojis":1,"no_lists":true,"one_question":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS objections text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS examples text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS handoff_triggers jsonb NOT NULL DEFAULT '["pide_humano","molestia","insiste_2","ya_hablo_asesor","fuera_alcance"]'::jsonb,
  ADD COLUMN IF NOT EXISTS handoff_message text NOT NULL DEFAULT 'Te comunico con un asesor que te da el detalle. Te contactará en tu horario.',
  ADD COLUMN IF NOT EXISTS profiled_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_rule text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS sla_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS privacy_url text NOT NULL DEFAULT '';

ALTER TABLE public.sales_agent_sessions
  ADD COLUMN IF NOT EXISTS missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_replied boolean NOT NULL DEFAULT false;