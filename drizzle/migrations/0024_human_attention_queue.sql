CREATE OR REPLACE FUNCTION public.pending_human_attention()
RETURNS TABLE(session_id uuid, contact_id uuid, contact_name text, owner_id uuid, owner_name text, conversation_id uuid, deal_id uuid, handoff_at timestamptz, reason text, agent_name text, channel text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
SELECT s.id,c.id,concat_ws(' ',c.name,c.last_name),c.owner_id,p.full_name,conv.id,d.id,s.handoff_at,s.handoff_reason,a.name,s.last_channel
FROM public.sales_agent_sessions s
JOIN public.contacts c ON c.id=s.contact_id AND c.tenant_id=s.tenant_id
JOIN public.sales_agents a ON a.id=s.agent_id
LEFT JOIN public.profiles p ON p.id=c.owner_id
LEFT JOIN LATERAL (SELECT cv.id FROM public.conversations cv WHERE cv.contact_id=c.id AND cv.tenant_id=s.tenant_id ORDER BY cv.last_message_at DESC NULLS LAST LIMIT 1) conv ON true
LEFT JOIN LATERAL (SELECT dl.id FROM public.deals dl JOIN public.pipeline_stages ps ON ps.id=dl.stage_id WHERE dl.contact_id=c.id AND dl.tenant_id=s.tenant_id AND ps.pipeline_id=s.pipeline_id AND NOT dl.is_won AND NOT dl.is_lost ORDER BY dl.created_at DESC LIMIT 1) d ON true
WHERE auth.uid() IS NOT NULL AND s.tenant_id=public.get_user_tenant(auth.uid()) AND s.state='escalated' AND s.handoff_at IS NOT NULL
AND (c.owner_id=auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND (ur.tenant_id=s.tenant_id OR ur.tenant_id IS NULL) AND ur.role IN ('tenant_admin','tenant_owner','sales_manager','super_admin','platform_owner','platform_staff')))
AND NOT EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations cv ON cv.id=m.conversation_id WHERE cv.contact_id=c.id AND cv.tenant_id=s.tenant_id AND m.direction='outbound' AND NOT m.is_internal_note AND m.sent_at>=s.handoff_at AND m.metadata->>'sent_by_user_id' IS NOT NULL AND COALESCE(m.metadata->>'bot','false')<>'true')
AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.contact_id=c.id AND t.tenant_id=s.tenant_id AND t.completed AND t.closed_at>=s.handoff_at AND t.closed_via IN ('call','email','whatsapp'))
ORDER BY s.handoff_at ASC;
$$;
REVOKE ALL ON FUNCTION public.pending_human_attention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pending_human_attention() TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS sales_agent_pending_handoff_idx ON public.sales_agent_sessions(tenant_id,handoff_at) WHERE state='escalated';