do $$
declare r record;
begin
  -- 1) Funciones de disparador: nunca deben llamarse directamente desde la API
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from anon, authenticated', r.sig);
  end loop;

  -- 2) Funciones internas de recurrencias que solo usan los disparadores / el servicio
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname in ('close_recurrence_from_deal', 'ensure_recurrence_subscription', 'recurrence_fill_horizon',
                        'ai_cleanup_old_data', 'ai_run_due_agents', 'ai_recompute_next_run',
                        'downgrade_expired_trials', 'email_queue_dispatch', 'enqueue_email', 'delete_email',
                        'read_email_batch', 'move_to_dlq', 'generate_recurring_expenses', 'mark_silent_deals',
                        'bootstrap_platform_owner')
  loop
    execute format('revoke all on function %s from anon, authenticated', r.sig);
  end loop;
end $$;