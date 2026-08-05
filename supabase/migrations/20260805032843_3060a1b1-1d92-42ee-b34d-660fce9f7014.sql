ALTER TABLE public.whatsapp_user_access
  ADD COLUMN IF NOT EXISTS web_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE VIEW public.platform_whatsapp_bot AS
  SELECT id, phone_number, display_name, label, status
  FROM public.whatsapp_channels
  WHERE is_platform = true;

GRANT SELECT ON public.platform_whatsapp_bot TO authenticated;