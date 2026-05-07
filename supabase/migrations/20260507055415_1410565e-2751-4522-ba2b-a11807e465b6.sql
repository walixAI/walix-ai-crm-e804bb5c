
-- 1. timezone en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Mexico_City';

-- 2. ai_usage_log
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  surface text NOT NULL, -- 'copilot' | 'agent'
  agent_id uuid,
  model text NOT NULL,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  iterations int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_tenant_idx ON public.ai_usage_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_surface_idx ON public.ai_usage_log (surface, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform reads ai_usage_log"
  ON public.ai_usage_log FOR SELECT
  USING (is_platform(auth.uid()) OR (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'tenant_owner'::app_role))));

-- 3. message_id en ai_draft_edits
ALTER TABLE public.ai_draft_edits
  ADD COLUMN IF NOT EXISTS message_id uuid,
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

CREATE INDEX IF NOT EXISTS ai_draft_edits_message_idx ON public.ai_draft_edits (message_id);
CREATE INDEX IF NOT EXISTS ai_draft_edits_conv_idx ON public.ai_draft_edits (conversation_id);

-- 4. vista A/B
CREATE OR REPLACE VIEW public.v_ai_draft_ab
WITH (security_invoker = true)
AS
SELECT
  e.id,
  e.tenant_id,
  e.user_id,
  e.contact_id,
  e.conversation_id,
  e.message_id,
  e.created_at,
  (e.char_delta <> 0 OR e.original <> e.edited) AS was_edited,
  ABS(e.char_delta) AS abs_char_delta,
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = e.conversation_id
      AND m.direction = 'inbound'
      AND m.sent_at BETWEEN e.created_at AND (e.created_at + interval '48 hours')
  ) AS got_reply,
  (
    SELECT EXTRACT(EPOCH FROM (MIN(m.sent_at) - e.created_at)) / 3600.0
    FROM public.messages m
    WHERE m.conversation_id = e.conversation_id
      AND m.direction = 'inbound'
      AND m.sent_at BETWEEN e.created_at AND (e.created_at + interval '48 hours')
  ) AS reply_within_hours
FROM public.ai_draft_edits e
WHERE e.conversation_id IS NOT NULL;

-- 5. extender limpieza semanal
CREATE OR REPLACE FUNCTION public.ai_cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_draft_edits WHERE created_at < now() - interval '90 days';
  DELETE FROM public.ai_outcome_feedback WHERE created_at < now() - interval '180 days';
  DELETE FROM public.notifications_queue WHERE delivered_at IS NOT NULL AND delivered_at < now() - interval '7 days';
  DELETE FROM public.ai_usage_log WHERE created_at < now() - interval '180 days';
END;
$$;
