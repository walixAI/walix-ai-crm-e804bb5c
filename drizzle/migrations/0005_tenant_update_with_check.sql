ALTER POLICY "tenant update deals" ON public.deals WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
ALTER POLICY "tenant update contacts" ON public.contacts WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
ALTER POLICY "tenant update conversations" ON public.conversations WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
ALTER POLICY "tenant update messages" ON public.messages WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- Coherencia: una oportunidad, conversación o atribución siempre pertenece a la misma empresa que su contacto.
CREATE OR REPLACE FUNCTION public.enforce_same_tenant_as_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  IF NEW.contact_id IS NULL THEN RETURN NEW; END IF;
  SELECT tenant_id INTO t FROM public.contacts WHERE id = NEW.contact_id;
  IF t IS NOT NULL AND t <> NEW.tenant_id THEN
    RAISE EXCEPTION 'El contacto pertenece a otra empresa';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_same_tenant_deals ON public.deals;
CREATE TRIGGER trg_same_tenant_deals BEFORE INSERT OR UPDATE OF tenant_id, contact_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant_as_contact();
DROP TRIGGER IF EXISTS trg_same_tenant_conversations ON public.conversations;
CREATE TRIGGER trg_same_tenant_conversations BEFORE INSERT OR UPDATE OF tenant_id, contact_id ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant_as_contact();
DROP TRIGGER IF EXISTS trg_same_tenant_attribution ON public.contact_attribution;
CREATE TRIGGER trg_same_tenant_attribution BEFORE INSERT OR UPDATE OF tenant_id, contact_id ON public.contact_attribution
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant_as_contact();