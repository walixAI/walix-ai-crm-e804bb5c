delete from public.dashboard_widgets a
using public.dashboard_widgets b
where a.key = b.key and a.surface = b.surface
  and a.tenant_id is null and b.tenant_id is null
  and a.created_at > b.created_at;