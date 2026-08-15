
DO $$
DECLARE
  v_tenant uuid := '6d0ad953-69a0-456a-a1e0-a0a19c5ce7e6';
  v_norma uuid := '0eadd5ac-b38c-436a-9e74-f057907bbe0c';
  v_by uuid;
  v_tasks jsonb; v_deals jsonb;
  v_task_ids uuid[]; v_deal_ids uuid[];
BEGIN
  SELECT id INTO v_by FROM public.profiles WHERE tenant_id = v_tenant AND email = 'moisescg937@gmail.com' LIMIT 1;
  IF v_by IS NULL THEN v_by := v_norma; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb), coalesce(array_agg(t.id), '{}')
    INTO v_tasks, v_task_ids
  FROM public.tasks t
  WHERE t.tenant_id = v_tenant AND t.assignee_id = v_norma
    AND t.created_at >= '2026-08-10' AND t.created_at < '2026-08-15';

  SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb), coalesce(array_agg(d.id), '{}')
    INTO v_deals, v_deal_ids
  FROM public.deals d
  WHERE d.tenant_id = v_tenant AND d.owner_id = v_norma
    AND d.created_at >= '2026-08-10' AND d.created_at < '2026-08-15'
    AND coalesce(d.is_won, false) = false;

  IF array_length(v_task_ids,1) > 0 THEN
    INSERT INTO public.bulk_edit_operations (tenant_id, requested_by, entity, filters, changes, target_ids, matched_count, applied_count, status, confirm_code, summary, snapshot, applied_at, expires_at)
    VALUES (v_tenant, v_by, 'tasks',
      jsonb_build_object('assignee','Norma Heredia','created_from','2026-08-10','created_to','2026-08-14'),
      jsonb_build_object('action','delete'), v_task_ids,
      array_length(v_task_ids,1), array_length(v_task_ids,1), 'applied', 'REDO-TASKS-0810',
      'Borrado de tareas de Norma creadas 10-14 ago 2026 (cualquier vencimiento)',
      v_tasks, now(), now() + interval '30 days');

    DELETE FROM public.tasks WHERE id = ANY(v_task_ids);
  END IF;

  IF array_length(v_deal_ids,1) > 0 THEN
    INSERT INTO public.bulk_edit_operations (tenant_id, requested_by, entity, filters, changes, target_ids, matched_count, applied_count, status, confirm_code, summary, snapshot, applied_at, expires_at)
    VALUES (v_tenant, v_by, 'deals',
      jsonb_build_object('owner','Norma Heredia','created_from','2026-08-10','created_to','2026-08-14','exclude','ganadas'),
      jsonb_build_object('action','delete'), v_deal_ids,
      array_length(v_deal_ids,1), array_length(v_deal_ids,1), 'applied', 'REDO-DEALS-0810',
      'Borrado de oportunidades de Norma creadas 10-14 ago 2026, excepto ganadas',
      v_deals, now(), now() + interval '30 days');

    DELETE FROM public.tasks WHERE deal_id = ANY(v_deal_ids);
    DELETE FROM public.activities WHERE deal_id = ANY(v_deal_ids);
    DELETE FROM public.deals WHERE id = ANY(v_deal_ids);
  END IF;
END $$;
