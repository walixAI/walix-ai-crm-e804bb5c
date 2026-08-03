REVOKE EXECUTE ON FUNCTION public.seed_default_deal_diagnostics(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_seed_deal_diagnostics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_deal_last_inbound() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_silent_deals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_deal_diagnostics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_silent_deals() TO service_role;