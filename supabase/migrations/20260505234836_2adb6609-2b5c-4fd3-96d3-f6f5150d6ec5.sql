ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_from text;