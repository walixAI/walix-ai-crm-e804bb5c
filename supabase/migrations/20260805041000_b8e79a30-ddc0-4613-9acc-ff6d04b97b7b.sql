alter table public.tenants disable trigger trg_protect_tenant_ai_model;

alter table public.tenants alter column ai_model set default 'google/gemini-3.6-flash';

update public.tenants
set ai_model = 'google/gemini-3.6-flash', ai_vendor = 'gemini'
where ai_model is null or ai_model = 'google/gemini-3.1-flash-lite';

alter table public.tenants enable trigger trg_protect_tenant_ai_model;