DO $$
DECLARE
  v_user_id uuid := '71f530ee-77d3-4b16-8c7b-fb9e8f189644';
  v_tenant_id uuid := '039a828d-7b97-4794-b06e-85f2d60d14ff';
  v_org_id uuid := '0843a7ab-9584-4247-84cb-b9febd1481a6';
BEGIN
  -- Datos dependientes del tenant
  DELETE FROM public.deal_stage_history WHERE tenant_id = v_tenant_id;
  DELETE FROM public.activities WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tasks WHERE tenant_id = v_tenant_id;
  DELETE FROM public.messages WHERE tenant_id = v_tenant_id;
  DELETE FROM public.conversations WHERE tenant_id = v_tenant_id;
  DELETE FROM public.deals WHERE tenant_id = v_tenant_id;
  DELETE FROM public.contacts WHERE tenant_id = v_tenant_id;
  DELETE FROM public.contact_tags WHERE tenant_id = v_tenant_id;
  DELETE FROM public.message_templates WHERE tenant_id = v_tenant_id;
  DELETE FROM public.automation_runs WHERE tenant_id = v_tenant_id;
  DELETE FROM public.automations WHERE tenant_id = v_tenant_id;
  DELETE FROM public.pipeline_stages WHERE tenant_id = v_tenant_id;
  DELETE FROM public.pipelines WHERE tenant_id = v_tenant_id;
  DELETE FROM public.ai_suggestions WHERE tenant_id = v_tenant_id;
  DELETE FROM public.notifications WHERE tenant_id = v_tenant_id;
  DELETE FROM public.audit_log WHERE tenant_id = v_tenant_id;
  DELETE FROM public.invitations WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tenant_modules WHERE tenant_id = v_tenant_id;

  -- Usuario
  DELETE FROM public.ai_feedback WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.organization_members WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Tenant y organización
  DELETE FROM public.tenants WHERE id = v_tenant_id;
  DELETE FROM public.organizations WHERE id = v_org_id;

  -- Auth
  DELETE FROM auth.users WHERE id = v_user_id;
END $$;