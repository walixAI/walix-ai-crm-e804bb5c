DO $$
DECLARE
  v_user uuid := '2a8c6b00-89fb-4873-afd8-13b228fae236';
  v_tenant uuid := '429b5855-14af-4505-8c92-274aff1bc63a';
  v_org uuid := '02f731b0-9804-49ee-a1b6-6b36ce64f7ac';
BEGIN
  DELETE FROM public.ai_feedback WHERE tenant_id = v_tenant;
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
  DELETE FROM public.audit_log WHERE tenant_id = v_tenant;
  DELETE FROM public.tenant_modules WHERE tenant_id = v_tenant;
  DELETE FROM public.user_roles WHERE user_id = v_user;
  DELETE FROM public.organization_members WHERE user_id = v_user OR organization_id = v_org;
  DELETE FROM public.profiles WHERE id = v_user;
  DELETE FROM public.tenants WHERE id = v_tenant;
  DELETE FROM public.organizations WHERE id = v_org;
  DELETE FROM auth.users WHERE id = v_user;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;