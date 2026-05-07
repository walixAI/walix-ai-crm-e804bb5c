
-- ai_user_profile
CREATE TABLE IF NOT EXISTS public.ai_user_profile (
  user_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  communication_style text NOT NULL DEFAULT 'formal',
  preferred_message_length text NOT NULL DEFAULT 'medium',
  best_close_day text,
  best_close_hour int,
  avg_response_time_hours double precision,
  top_performing_stage text,
  close_rate double precision NOT NULL DEFAULT 0,
  total_deals_closed int NOT NULL DEFAULT 0,
  total_deals_lost int NOT NULL DEFAULT 0,
  strengths text[] NOT NULL DEFAULT '{}',
  improvement_areas text[] NOT NULL DEFAULT '{}',
  custom_instructions text NOT NULL DEFAULT '',
  notify_only_work_hours boolean NOT NULL DEFAULT false,
  notify_digest_9am boolean NOT NULL DEFAULT false,
  allow_auto_tasks boolean NOT NULL DEFAULT true,
  weekly_coaching_report boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner or admin select ai_user_profile"
  ON public.ai_user_profile FOR SELECT
  USING (
    is_platform(auth.uid())
    OR user_id = auth.uid()
    OR (tenant_id = get_user_tenant(auth.uid())
        AND (has_role(auth.uid(),'tenant_admin') OR has_role(auth.uid(),'tenant_owner')))
  );

CREATE POLICY "owner inserts ai_user_profile"
  ON public.ai_user_profile FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "owner updates ai_user_profile"
  ON public.ai_user_profile FOR UPDATE
  USING (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE TRIGGER set_updated_at_ai_user_profile
  BEFORE UPDATE ON public.ai_user_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ai_draft_edits
CREATE TABLE IF NOT EXISTS public.ai_draft_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  original text NOT NULL,
  edited text NOT NULL,
  char_delta int NOT NULL DEFAULT 0,
  contact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_draft_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select ai_draft_edits"
  ON public.ai_draft_edits FOR SELECT
  USING (
    is_platform(auth.uid())
    OR (tenant_id = get_user_tenant(auth.uid())
        AND (user_id = auth.uid()
             OR has_role(auth.uid(),'tenant_admin')
             OR has_role(auth.uid(),'tenant_owner')))
  );

CREATE POLICY "owner inserts ai_draft_edits"
  ON public.ai_draft_edits FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant(auth.uid()));

CREATE INDEX IF NOT EXISTS ai_draft_edits_tenant_user_idx
  ON public.ai_draft_edits (tenant_id, user_id, created_at DESC);

-- Auto-seed function + trigger on profiles
CREATE OR REPLACE FUNCTION public.seed_ai_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    INSERT INTO public.ai_user_profile(user_id, tenant_id)
    VALUES (NEW.id, NEW.tenant_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_ai_user_profile ON public.profiles;
CREATE TRIGGER trg_seed_ai_user_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_ai_user_profile();

-- Backfill for existing profiles
INSERT INTO public.ai_user_profile (user_id, tenant_id)
SELECT p.id, COALESCE(p.active_tenant_id, p.tenant_id)
FROM public.profiles p
WHERE COALESCE(p.active_tenant_id, p.tenant_id) IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
