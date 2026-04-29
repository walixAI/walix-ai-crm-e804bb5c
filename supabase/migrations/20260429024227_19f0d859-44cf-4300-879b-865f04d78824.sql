-- Categories and severity enums
CREATE TYPE public.notification_category AS ENUM ('operational', 'ai', 'system');
CREATE TYPE public.notification_severity AS ENUM ('info', 'success', 'warning', 'danger');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NULL, -- NULL = broadcast to all tenant members
  category public.notification_category NOT NULL DEFAULT 'operational',
  type text NOT NULL, -- e.g. 'deal_at_risk', 'whatsapp_sla', 'ai_inbox', 'plan_limit'
  title text NOT NULL,
  body text NULL,
  link text NULL, -- e.g. '/pipeline?deal=123'
  icon text NULL, -- lucide icon name
  severity public.notification_severity NOT NULL DEFAULT 'info',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_tenant_user_read
  ON public.notifications (tenant_id, user_id, read_at, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant or recipient reads notifications"
ON public.notifications FOR SELECT
USING (
  is_platform(auth.uid())
  OR (
    tenant_id = get_user_tenant(auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
);

CREATE POLICY "tenant member inserts notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  is_platform(auth.uid())
  OR tenant_id = get_user_tenant(auth.uid())
);

CREATE POLICY "recipient or tenant marks read"
ON public.notifications FOR UPDATE
USING (
  is_platform(auth.uid())
  OR (
    tenant_id = get_user_tenant(auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
)
WITH CHECK (
  is_platform(auth.uid())
  OR (
    tenant_id = get_user_tenant(auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
);

CREATE POLICY "recipient admin or platform deletes"
ON public.notifications FOR DELETE
USING (
  is_platform(auth.uid())
  OR (
    tenant_id = get_user_tenant(auth.uid())
    AND (
      user_id = auth.uid()
      OR has_role(auth.uid(), 'tenant_admin'::app_role)
      OR has_role(auth.uid(), 'tenant_owner'::app_role)
    )
  )
);

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;