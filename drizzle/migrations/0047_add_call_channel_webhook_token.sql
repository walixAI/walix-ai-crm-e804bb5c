ALTER TABLE public.call_channels ADD COLUMN IF NOT EXISTS webhook_token text;
UPDATE public.call_channels SET webhook_token = replace(gen_random_uuid()::text, '-', '') WHERE webhook_token IS NULL;
GRANT ALL ON public.call_channels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_channels TO authenticated;