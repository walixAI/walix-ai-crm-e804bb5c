-- Agentes de venta por Pipeline: identidad, conocimiento, objetivos, reparto por dimensiones y sesiones multicanal.
create table public.sales_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null default 'Agente de ventas',
  identity text not null default '',
  tone text not null default 'Cercano y profesional',
  language text not null default 'es',
  never_do text not null default '',
  enabled boolean not null default false,
  is_default boolean not null default false,
  assignment_conditions jsonb not null default '[]'::jsonb,
  priority integer not null default 100,
  default_goal text not null default '',
  default_key_message text not null default '',
  default_handoff jsonb not null default '{}'::jsonb,
  default_allow_close boolean not null default false,
  autonomy text not null default 'solo_sugiere' check (autonomy in ('solo_sugiere','mixto','autonomo')),
  autonomy_config jsonb not null default '{}'::jsonb,
  channels jsonb not null default '{"whatsapp":true,"web":false}'::jsonb,
  caps jsonb not null default '{}'::jsonb,
  public_key text not null default encode(gen_random_bytes(24),'hex') unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sales_agents_one_default_per_pipeline on public.sales_agents (pipeline_id) where is_default;
create index sales_agents_pipeline_idx on public.sales_agents (pipeline_id);
create index sales_agents_tenant_idx on public.sales_agents (tenant_id);

create table public.sales_agent_knowledge (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid references public.sales_agents(id) on delete cascade, -- null = conocimiento compartido de la empresa
  kind text not null default 'text' check (kind in ('text','faq','pdf','url','product')),
  title text not null default '',
  content text not null default '',
  url text,
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_agent_knowledge_agent_idx on public.sales_agent_knowledge (agent_id);
create index sales_agent_knowledge_tenant_idx on public.sales_agent_knowledge (tenant_id);

create table public.sales_agent_goal_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid not null references public.sales_agents(id) on delete cascade,
  name text not null default 'Regla',
  priority integer not null default 100,
  conditions jsonb not null default '{}'::jsonb, -- {source_kind, program, date_from, date_to, stage_ids, owner_ids, owner_roles, tags, city, score_min, score_max}
  goal text not null default '',
  key_message text not null default '',
  autonomy text not null default 'solo_sugiere' check (autonomy in ('solo_sugiere','mixto','autonomo')),
  handoff_rules jsonb not null default '{}'::jsonb,
  allow_close boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_agent_goal_rules_agent_idx on public.sales_agent_goal_rules (agent_id, priority);

create table public.sales_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id uuid not null references public.sales_agents(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  state text not null default 'agent' check (state in ('agent','escalated','advisor')),
  applied_rule_id uuid references public.sales_agent_goal_rules(id) on delete set null,
  applied_goal text not null default '',
  plan jsonb not null default '{}'::jsonb,
  profile_data jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  last_channel text not null default 'whatsapp',
  replies_today integer not null default 0,
  replies_date date,
  last_agent_message_at timestamptz,
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, agent_id)
);
create index sales_agent_sessions_contact_idx on public.sales_agent_sessions (tenant_id, contact_id);

create table public.web_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid not null references public.sales_agents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  pipeline_id uuid references public.pipelines(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  visitor_name text not null default '',
  visitor_phone text not null default '',
  visitor_email text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index web_chat_sessions_tenant_idx on public.web_chat_sessions (tenant_id, created_at desc);

create table public.web_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.web_chat_sessions(id) on delete cascade,
  role text not null check (role in ('visitor','agent')),
  body text not null,
  created_at timestamptz not null default now()
);
create index web_chat_messages_session_idx on public.web_chat_messages (session_id, created_at);

-- GRANTs
grant select, insert, update, delete on public.sales_agents to authenticated;
grant all on public.sales_agents to service_role;
grant select, insert, update, delete on public.sales_agent_knowledge to authenticated;
grant all on public.sales_agent_knowledge to service_role;
grant select, insert, update, delete on public.sales_agent_goal_rules to authenticated;
grant all on public.sales_agent_goal_rules to service_role;
grant select, update on public.sales_agent_sessions to authenticated;
grant all on public.sales_agent_sessions to service_role;
grant select on public.web_chat_sessions to authenticated;
grant select on public.web_chat_messages to authenticated;
grant all on public.web_chat_sessions to service_role;
grant all on public.web_chat_messages to service_role;

-- RLS
alter table public.sales_agents enable row level security;
create policy "sales_agents tenant read" on public.sales_agents for select to authenticated
  using ((tenant_id = get_user_tenant(auth.uid())) or is_platform(auth.uid()));
create policy "sales_agents tenant write" on public.sales_agents for insert to authenticated
  with check (tenant_id = get_user_tenant(auth.uid()));
create policy "sales_agents tenant update" on public.sales_agents for update to authenticated
  using (tenant_id = get_user_tenant(auth.uid()));
create policy "sales_agents tenant delete" on public.sales_agents for delete to authenticated
  using (tenant_id = get_user_tenant(auth.uid()));

alter table public.sales_agent_knowledge enable row level security;
create policy "sales_agent_knowledge tenant read" on public.sales_agent_knowledge for select to authenticated
  using ((tenant_id = get_user_tenant(auth.uid())) or is_platform(auth.uid()));
create policy "sales_agent_knowledge tenant write" on public.sales_agent_knowledge for insert to authenticated
  with check (tenant_id = get_user_tenant(auth.uid()));
create policy "sales_agent_knowledge tenant update" on public.sales_agent_knowledge for update to authenticated
  using (tenant_id = get_user_tenant(auth.uid()));
create policy "sales_agent_knowledge tenant delete" on public.sales_agent_knowledge for delete to authenticated
  using (tenant_id = get_user_tenant(auth.uid()));

alter table public.sales_agent_goal_rules enable row level security;
create policy "sales_agent_goal_rules tenant read" on public.sales_agent_goal_rules for select to authenticated
  using ((tenant_id = get_user_tenant(auth.uid())) or is_platform(auth.uid()));
create policy "sales_agent_goal_rules tenant write" on public.sales_agent_goal_rules for insert to authenticated
  with check (tenant_id = get_user_tenant(auth.uid()));
create policy "sales_agent_goal_rules tenant update" on public.sales_agent_goal_rules for update to authenticated
  using (tenant_id = get_user_tenant(auth.uid()));
create policy "sales_agent_goal_rules tenant delete" on public.sales_agent_goal_rules for delete to authenticated
  using (tenant_id = get_user_tenant(auth.uid()));

alter table public.sales_agent_sessions enable row level security;
create policy "sales_agent_sessions tenant read" on public.sales_agent_sessions for select to authenticated
  using ((tenant_id = get_user_tenant(auth.uid())) or is_platform(auth.uid()));
create policy "sales_agent_sessions tenant update" on public.sales_agent_sessions for update to authenticated
  using (tenant_id = get_user_tenant(auth.uid()));

alter table public.web_chat_sessions enable row level security;
create policy "web_chat_sessions tenant read" on public.web_chat_sessions for select to authenticated
  using ((tenant_id = get_user_tenant(auth.uid())) or is_platform(auth.uid()));

alter table public.web_chat_messages enable row level security;
create policy "web_chat_messages tenant read" on public.web_chat_messages for select to authenticated
  using ((tenant_id = get_user_tenant(auth.uid())) or is_platform(auth.uid()));

-- updated_at
create trigger trg_sales_agents_updated before update on public.sales_agents for each row execute function public.set_updated_at();
create trigger trg_sales_agent_knowledge_updated before update on public.sales_agent_knowledge for each row execute function public.set_updated_at();
create trigger trg_sales_agent_goal_rules_updated before update on public.sales_agent_goal_rules for each row execute function public.set_updated_at();
create trigger trg_sales_agent_sessions_updated before update on public.sales_agent_sessions for each row execute function public.set_updated_at();

-- Nacer con el Pipeline: agente por defecto apagado.
create or replace function public.sales_agent_seed_for_pipeline()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.sales_agents (tenant_id, pipeline_id, is_default, name)
  values (new.tenant_id, new.id, true, 'Agente de ' || new.name)
  on conflict do nothing;
  return new;
end; $$;
create trigger trg_seed_sales_agent after insert on public.pipelines for each row execute function public.sales_agent_seed_for_pipeline();

-- Backfill: cada Pipeline existente recibe su agente por defecto (apagado).
insert into public.sales_agents (tenant_id, pipeline_id, is_default, name)
select p.tenant_id, p.id, true, 'Agente de ' || p.name
from public.pipelines p
where not exists (select 1 from public.sales_agents s where s.pipeline_id = p.id);