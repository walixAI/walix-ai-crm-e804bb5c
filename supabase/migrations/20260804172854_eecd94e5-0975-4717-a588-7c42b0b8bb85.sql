CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_channels_single_platform
  ON public.whatsapp_channels ((is_platform)) WHERE is_platform;

DROP POLICY IF EXISTS "platform manage wa user access" ON public.whatsapp_user_access;
CREATE POLICY "platform manage wa user access" ON public.whatsapp_user_access FOR ALL TO authenticated
  USING (public.is_platform(auth.uid())) WITH CHECK (public.is_platform(auth.uid()));