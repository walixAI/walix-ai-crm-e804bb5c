-- lovable-cron-fallback-reviewed: marcado y remarcado de campañas es trabajo genuinamente programado por hora (next_attempt_at); mismo patrón que wa-campaign-worker-10m
select cron.schedule(
  'call-campaign-worker-5m',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qomyfafowhuxuwbuubqk.supabase.co/functions/v1/call-campaign-worker',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);