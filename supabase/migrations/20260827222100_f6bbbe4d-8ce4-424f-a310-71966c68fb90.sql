select cron.schedule(
  'wa-campaign-worker-10m',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qomyfafowhuxuwbuubqk.supabase.co/functions/v1/wa-campaign-worker',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);