DELETE FROM public.conversations v
WHERE NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = v.id)
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_conversation_billing b WHERE b.conversation_id = v.id)
  AND NOT EXISTS (SELECT 1 FROM public.wa_step_sends s WHERE s.conversation_id = v.id)
  AND EXISTS (SELECT 1 FROM public.conversations o WHERE o.tenant_id = v.tenant_id AND o.contact_id = v.contact_id AND o.id <> v.id
              AND (o.created_at < v.created_at OR EXISTS (SELECT 1 FROM public.messages m2 WHERE m2.conversation_id = o.id)));
CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_per_contact ON public.conversations (tenant_id, contact_id) WHERE contact_id IS NOT NULL;