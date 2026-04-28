create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid,
  prompt text not null,
  answer text not null,
  rating smallint not null check (rating in (-1, 1)),
  comment text,
  surface text not null default 'ai_drawer',
  created_at timestamptz not null default now()
);

alter table public.ai_feedback enable row level security;

create policy "Users can insert their own AI feedback"
  on public.ai_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own AI feedback"
  on public.ai_feedback for select
  to authenticated
  using (auth.uid() = user_id);

create index ai_feedback_user_created_idx on public.ai_feedback (user_id, created_at desc);
create index ai_feedback_rating_idx on public.ai_feedback (rating);