with c1 as (
  insert into public.wa_campaigns (tenant_id, name, objective, rule_mode, conditions, priority, schedule, stop_on_reply, stop_on_stage_change, stop_on_closed, is_active)
  values ('2014632c-32d7-4b81-b0c0-f1408279caf2', 'Sesión de diagnóstico', 'agendar', 'filters',
    '{"stage_ids":["d0f744b4-f56b-4b6e-b569-6f0b8d52b1f3","fd415e09-f0bc-4008-bb9a-25fae0dc1b82"],"lifecycle":["prospecto"]}'::jsonb, 10,
    '{"tz":"America/Mexico_City","days":[2,4,5],"start":"10:00","end":"13:00"}'::jsonb, true, true, true, true)
  returning id, tenant_id
), c2 as (
  insert into public.wa_campaigns (tenant_id, name, objective, rule_mode, conditions, priority, schedule, stop_on_reply, stop_on_stage_change, stop_on_closed, is_active)
  values ('2014632c-32d7-4b81-b0c0-f1408279caf2', 'Reactivación', 'reactivar', 'filters',
    '{"no_reply_days":7,"lifecycle":["prospecto"]}'::jsonb, 20,
    '{"tz":"America/Mexico_City","days":[2,4,5],"start":"10:00","end":"13:00"}'::jsonb, true, true, true, true)
  returning id, tenant_id
)
insert into public.wa_campaign_steps (campaign_id, tenant_id, step_order, wait_hours, kind, template_id, template_variables, body_text)
select id, tenant_id, 0, 24, 'template'::text, '488aef70-6c47-4e96-8c2a-ebfc67510c5b'::uuid, '["{{nombre}}","la estrategia de matrícula de su institución"]'::jsonb, null::text from c1
union all
select id, tenant_id, 0, 0, 'template'::text, 'c48d81fe-2e9c-45b7-9c0b-be1270f6fdd0'::uuid, '["{{nombre}}"]'::jsonb, null::text from c2;