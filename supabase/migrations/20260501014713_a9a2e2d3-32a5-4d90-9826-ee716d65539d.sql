DO $$
DECLARE
  v_user uuid := '87750367-3490-4120-bb46-29d4f1349fc3';
  v_tenant uuid := '97180ec4-416b-46de-af1c-7ecf379ad7b6';
  v_org uuid := 'fc8db393-a952-4c5e-b61c-0cdba99420fd';
BEGIN
  DELETE FROM public.ai_feedback WHERE tenant_id = v_tenant OR user_id = v_user;
  DELETE FROM public.ai_suggestions WHERE tenant_id = v_tenant;
  DELETE FROM public.automation_runs WHERE tenant_id = v_tenant;
  DELETE FROM public.automations WHERE tenant_id = v_tenant;
  DELETE FROM public.activities WHERE tenant_id = v_tenant;
  DELETE FROM public.tasks WHERE tenant_id = v_tenant;
  DELETE FROM public.messages WHERE tenant_id = v_tenant;
  DELETE FROM public.conversations WHERE tenant_id = v_tenant;
  DELETE FROM public.message_templates WHERE tenant_id = v_tenant;
  DELETE FROM public.deal_stage_history WHERE tenant_id = v_tenant;
  DELETE FROM public.deals WHERE tenant_id = v_tenant;
  DELETE FROM public.pipeline_stages WHERE tenant_id = v_tenant;
  DELETE FROM public.pipelines WHERE tenant_id = v_tenant;
  DELETE FROM public.contact_tags WHERE tenant_id = v_tenant;
  DELETE FROM public.contacts WHERE tenant_id = v_tenant;
  DELETE FROM public.invitations WHERE tenant_id = v_tenant;
  DELETE FROM public.notifications WHERE tenant_id = v_tenant;
  DELETE FROM public.audit_log WHERE tenant_id = v_tenant OR actor_id = v_user;
  DELETE FROM public.tenant_modules WHERE tenant_id = v_tenant;
  DELETE FROM public.user_roles WHERE user_id = v_user;
  DELETE FROM public.organization_members WHERE user_id = v_user OR organization_id = v_org;
  DELETE FROM public.profiles WHERE id = v_user;
  DELETE FROM public.tenants WHERE id = v_tenant;
  DELETE FROM public.organizations WHERE id = v_org;
  DELETE FROM auth.users WHERE id = v_user;
END $$;