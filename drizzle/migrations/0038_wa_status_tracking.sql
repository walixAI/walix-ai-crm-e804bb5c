-- Estados de entrega/lectura de WhatsApp en mensajes enviados
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS wa_status text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_messages_wamid ON public.messages ((metadata->>'wamid'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
