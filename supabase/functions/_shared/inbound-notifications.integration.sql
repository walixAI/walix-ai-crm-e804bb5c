-- Run through the database query tool; all fixture writes roll back.
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
DECLARE t uuid; u uuid; c uuid := gen_random_uuid(); n integer;
BEGIN
 SELECT r.tenant_id,r.user_id INTO t,u FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id AND p.is_active
 WHERE r.tenant_id IS NOT NULL AND r.role IN ('tenant_admin','tenant_owner','sales_manager') LIMIT 1;
 IF t IS NULL THEN RAISE EXCEPTION 'An active tenant supervisor is required'; END IF;
 INSERT INTO public.calls(id,tenant_id,direction,from_number,to_number,status,ended_at)
 VALUES(c,t,'inbound','+525500000000','+525511111111','no_answer',now());
 SELECT count(*) INTO n FROM public.notifications WHERE data->>'call_id'=c::text AND type='missed_inbound_call';
 IF n=0 THEN RAISE EXCEPTION 'Unassigned missed call did not notify supervisors'; END IF;
 IF EXISTS(SELECT 1 FROM public.notifications WHERE data->>'call_id'=c::text AND tenant_id<>t) THEN RAISE EXCEPTION 'Cross-tenant notification'; END IF;
 UPDATE public.calls SET status='no_answer' WHERE id=c;
 IF (SELECT count(*) FROM public.notifications WHERE data->>'call_id'=c::text)<>n THEN RAISE EXCEPTION 'Repeated callback duplicated alerts'; END IF;
 c:=gen_random_uuid();
 INSERT INTO public.calls(id,tenant_id,user_id,direction,from_number,to_number,status)
 VALUES(c,t,u,'inbound','+525500000000','+525511111111','ringing');
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE data->>'call_id'=c::text AND user_id=u AND type='inbound_call') THEN RAISE EXCEPTION 'Assigned advisor did not receive alert'; END IF;
 UPDATE public.calls SET status='answered',answered_at=now() WHERE id=c;
 IF EXISTS(SELECT 1 FROM public.notifications WHERE data->>'call_id'=c::text AND type='inbound_call' AND read_at IS NULL) THEN RAISE EXCEPTION 'Stale ringing alert'; END IF;
 UPDATE public.calls SET status='completed',duration_seconds=43,ended_at=now() WHERE id=c;
 IF EXISTS(SELECT 1 FROM public.notifications WHERE data->>'call_id'=c::text AND type='missed_inbound_call') THEN RAISE EXCEPTION 'Attended call flagged missed'; END IF;
END $$;
ROLLBACK;