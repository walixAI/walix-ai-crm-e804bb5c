REVOKE EXECUTE ON FUNCTION public.wa_open_window(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.wa_charge_conversation(uuid, uuid, uuid, uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.wa_open_window(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wa_charge_conversation(uuid, uuid, uuid, uuid, text, text) TO authenticated, service_role;