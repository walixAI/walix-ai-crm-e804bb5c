CREATE INDEX IF NOT EXISTS idx_ai_conv_hist_lookup
  ON public.ai_conversation_history (tenant_id, user_id, session_id, created_at DESC);

ALTER TABLE public.ai_conversation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own copilot history" ON public.ai_conversation_history;
CREATE POLICY "Users read own copilot history"
  ON public.ai_conversation_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "Users insert own copilot history" ON public.ai_conversation_history;
CREATE POLICY "Users insert own copilot history"
  ON public.ai_conversation_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant(auth.uid()));

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_ai_context_updater()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  edge_url text := 'https://qomyfafowhuxuwbuubqk.supabase.co/functions/v1/ai-context-updater';
  service_key text;
BEGIN
  service_key := current_setting('app.settings.service_role_key', true);
  IF service_key IS NULL OR service_key = '' THEN
    RETURN NEW;
  END IF;
  PERFORM extensions.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_memory_events_after_insert ON public.ai_memory_events;
CREATE TRIGGER ai_memory_events_after_insert
AFTER INSERT ON public.ai_memory_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_ai_context_updater();