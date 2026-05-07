
CREATE TABLE IF NOT EXISTS public.notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT 'work_hours',
  deliver_after timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_queue_due_idx
  ON public.notifications_queue (deliver_after)
  WHERE delivered_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_queue_user_idx
  ON public.notifications_queue (user_id, created_at DESC);

ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads notifications_queue"
  ON public.notifications_queue FOR SELECT
  USING (
    is_platform(auth.uid())
    OR (tenant_id = get_user_tenant(auth.uid()) AND user_id = auth.uid())
  );

CREATE POLICY "owner deletes notifications_queue"
  ON public.notifications_queue FOR DELETE
  USING (tenant_id = get_user_tenant(auth.uid()) AND user_id = auth.uid());

-- Retención semanal
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
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('ai-cleanup-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ai-cleanup-weekly',
  '0 4 * * 0',
  $$ SELECT public.ai_cleanup_old_data() $$
);
