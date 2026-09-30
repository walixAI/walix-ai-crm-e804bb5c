CREATE OR REPLACE FUNCTION public.wa_request_extra_attempt(_contact_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_name text; v_req text; n int := 0;
BEGIN
  SELECT tenant_id, name INTO v_tenant, v_name FROM contacts WHERE id = _contact_id;
  IF v_tenant IS NULL OR NOT public.user_can_use_tenant(auth.uid(), v_tenant) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(full_name, email) INTO v_req FROM profiles WHERE id = auth.uid();
  INSERT INTO notifications (tenant_id, user_id, category, severity, type, title, body, link)
  SELECT DISTINCT v_tenant, ur.user_id, 'operational', 'warning', 'wa_spend_request',
         'Autorización para escribir por WhatsApp',
         format('%s pide un intento más para escribirle a %s (límite de plantillas alcanzado).', COALESCE(v_req,'Un asesor'), COALESCE(v_name,'un lead')),
         '/whatsapp?contactId=' || _contact_id::text
    FROM user_roles ur
   WHERE ur.tenant_id = v_tenant AND ur.user_id <> auth.uid()
     AND ur.role IN ('tenant_admin','tenant_owner','sales_manager','org_owner');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.wa_request_extra_attempt(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wa_request_extra_attempt(uuid) TO authenticated, service_role;