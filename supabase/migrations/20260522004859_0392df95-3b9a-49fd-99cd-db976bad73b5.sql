
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_webhook_payload jsonb;

CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  received_at timestamptz not null default now(),
  phone_number_id text,
  matched_channel_id uuid null,
  kind text not null check (kind in ('verify','message','status','unknown')),
  payload jsonb,
  note text
);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_log_tenant_time
  ON public.whatsapp_webhook_log(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_log_time
  ON public.whatsapp_webhook_log(received_at DESC);

ALTER TABLE public.whatsapp_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant admins read their webhook log"
  ON public.whatsapp_webhook_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'tenant_owner'))
  );

CREATE POLICY "platform staff read all webhook log"
  ON public.whatsapp_webhook_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform(auth.uid()));
