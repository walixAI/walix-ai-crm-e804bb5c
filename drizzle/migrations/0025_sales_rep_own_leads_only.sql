CREATE OR REPLACE FUNCTION public.is_rep_only(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='sales_rep'
                 AND (tenant_id=_tenant_id OR tenant_id IS NULL))
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id
                 AND role IN ('tenant_owner','tenant_admin','sales_manager')
                 AND (tenant_id=_tenant_id OR tenant_id IS NULL))
     AND NOT public.is_platform(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.rep_owns_contact(_user_id uuid, _contact_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contacts WHERE id=_contact_id AND owner_id=_user_id)
      OR EXISTS (SELECT 1 FROM public.deals WHERE contact_id=_contact_id AND owner_id=_user_id)
      OR EXISTS (SELECT 1 FROM public.conversations WHERE contact_id=_contact_id AND assignee_id=_user_id)
$$;

CREATE OR REPLACE FUNCTION public.rep_owns_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=_conversation_id
     AND (c.assignee_id=_user_id OR (c.contact_id IS NOT NULL AND public.rep_owns_contact(_user_id, c.contact_id))))
$$;

GRANT EXECUTE ON FUNCTION public.is_rep_only(uuid,uuid), public.rep_owns_contact(uuid,uuid), public.rep_owns_conversation(uuid,uuid) TO authenticated;

CREATE POLICY "rep own contacts" ON public.contacts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR owner_id = auth.uid() OR public.rep_owns_contact(auth.uid(), id));
CREATE POLICY "rep own contacts upd" ON public.contacts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR owner_id = auth.uid() OR public.rep_owns_contact(auth.uid(), id));
CREATE POLICY "rep no delete contacts" ON public.contacts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id));

CREATE POLICY "rep own deals" ON public.deals AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR owner_id = auth.uid() OR (contact_id IS NOT NULL AND public.rep_owns_contact(auth.uid(), contact_id)));
CREATE POLICY "rep own deals upd" ON public.deals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR owner_id = auth.uid() OR (contact_id IS NOT NULL AND public.rep_owns_contact(auth.uid(), contact_id)));
CREATE POLICY "rep no delete deals" ON public.deals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id));

CREATE POLICY "rep own conversations" ON public.conversations AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR public.rep_owns_conversation(auth.uid(), id));
CREATE POLICY "rep own conversations upd" ON public.conversations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR public.rep_owns_conversation(auth.uid(), id));

CREATE POLICY "rep own messages" ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR public.rep_owns_conversation(auth.uid(), conversation_id));

CREATE POLICY "rep own tasks" ON public.tasks AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_rep_only(auth.uid(), tenant_id) OR assignee_id = auth.uid() OR (contact_id IS NOT NULL AND public.rep_owns_contact(auth.uid(), contact_id)));