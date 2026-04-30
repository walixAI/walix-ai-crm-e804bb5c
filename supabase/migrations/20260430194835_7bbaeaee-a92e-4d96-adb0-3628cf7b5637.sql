DO $$
DECLARE
  v_user_id uuid := 'd5c21007-872c-46fd-b924-bb60550209f6';
  v_tenant_id uuid := '21621bbd-5c5b-43e5-b729-1268b96dd0d3';
  v_org_id uuid := '4de0bebe-eeff-4c1b-89df-df3b1e943009';
BEGIN
  -- Borrar datos del tenant (orden respeta dependencias lógicas)
  DELETE FROM public.messages WHERE tenant_id = v_tenant_id;
  DELETE FROM public.conversations WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tasks WHERE tenant_id = v_tenant_id;
  DELETE FROM public.activities WHERE tenant_id = v_tenant_id;
  DELETE FROM public.deal_stage_history WHERE tenant_id = v_tenant_id;
  DELETE FROM public.ai_suggestions WHERE tenant_id = v_tenant_id;
  DELETE FROM public.deals WHERE tenant_id = v_tenant_id;
  DELETE FROM public.contacts WHERE tenant_id = v_tenant_id;
  DELETE FROM public.contact_tags WHERE tenant_id = v_tenant_id;
  DELETE FROM public.message_templates WHERE tenant_id = v_tenant_id;
  DELETE FROM public.pipeline_stages WHERE tenant_id = v_tenant_id;
  DELETE FROM public.pipelines WHERE tenant_id = v_tenant_id;
  DELETE FROM public.automation_runs WHERE tenant_id = v_tenant_id;
  DELETE FROM public.automations WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tenant_modules WHERE tenant_id = v_tenant_id;
  DELETE FROM public.invitations WHERE tenant_id = v_tenant_id;
  DELETE FROM public.notifications WHERE tenant_id = v_tenant_id;
  DELETE FROM public.audit_log WHERE tenant_id = v_tenant_id OR actor_id = v_user_id;
  DELETE FROM public.ai_feedback WHERE user_id = v_user_id OR tenant_id = v_tenant_id;

  -- Roles, perfil, membresías
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.organization_members WHERE user_id = v_user_id OR organization_id = v_org_id;
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Tenant y organización
  DELETE FROM public.tenants WHERE id = v_tenant_id;
  DELETE FROM public.organizations WHERE id = v_org_id;

  -- Finalmente, el usuario en auth
  DELETE FROM auth.users WHERE id = v_user_id;
END $$;