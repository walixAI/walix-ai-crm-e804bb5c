DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.calls REPLICA IDENTITY FULL;