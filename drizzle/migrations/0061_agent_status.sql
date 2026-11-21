CREATE TABLE public.agent_status_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('available','pause','offline')),
  max_minutes integer,
  productive boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_status_reasons TO authenticated;
GRANT ALL ON public.agent_status_reasons TO service_role;
ALTER TABLE public.agent_status_reasons ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.agent_status_is_supervisor(_uid uuid, _tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform(_uid) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND tenant_id=_tenant AND role IN ('tenant_owner','tenant_admin','sales_manager','super_admin'))
$$;
CREATE OR REPLACE FUNCTION public.agent_status_is_admin(_uid uuid, _tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform(_uid) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND tenant_id=_tenant AND role IN ('tenant_owner','tenant_admin','super_admin'))
$$;

CREATE POLICY "asr read" ON public.agent_status_reasons FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "asr insert" ON public.agent_status_reasons FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.agent_status_is_admin(auth.uid(), tenant_id));
CREATE POLICY "asr update" ON public.agent_status_reasons FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.agent_status_is_admin(auth.uid(), tenant_id)) WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "asr delete" ON public.agent_status_reasons FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.agent_status_is_admin(auth.uid(), tenant_id));

CREATE TABLE public.agent_status_current (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason_id uuid REFERENCES public.agent_status_reasons(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'offline',
  reason_name text NOT NULL DEFAULT 'Desconectado',
  since timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  set_by uuid,
  PRIMARY KEY (tenant_id, user_id)
);
GRANT SELECT ON public.agent_status_current TO authenticated;
GRANT ALL ON public.agent_status_current TO service_role;
ALTER TABLE public.agent_status_current ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asc read" ON public.agent_status_current FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TABLE public.agent_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason_id uuid,
  kind text NOT NULL,
  reason_name text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  set_by uuid,
  ended_by uuid,
  end_cause text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_status_log_idx ON public.agent_status_log (tenant_id, started_at DESC);
GRANT SELECT ON public.agent_status_log TO authenticated;
GRANT ALL ON public.agent_status_log TO service_role;
ALTER TABLE public.agent_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asl read" ON public.agent_status_log FOR SELECT TO authenticated USING (
  tenant_id = public.get_user_tenant(auth.uid()) AND (user_id = auth.uid() OR public.agent_status_is_supervisor(auth.uid(), tenant_id)));

CREATE OR REPLACE FUNCTION public.seed_agent_status_reasons(_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.agent_status_reasons (tenant_id,name,kind,max_minutes,productive,sort_order) VALUES
   (_tenant,'Disponible','available',NULL,true,0),
   (_tenant,'Baño','pause',10,false,10),
   (_tenant,'Comida','pause',60,false,20),
   (_tenant,'Descanso','pause',15,false,30),
   (_tenant,'Coaching','pause',60,true,40),
   (_tenant,'Capacitación','pause',120,true,50),
   (_tenant,'Junta','pause',60,true,60),
   (_tenant,'Trabajo administrativo','pause',60,true,70),
   (_tenant,'Desconectado','offline',NULL,false,100)
  ON CONFLICT (tenant_id,name) DO NOTHING
$$;
REVOKE EXECUTE ON FUNCTION public.seed_agent_status_reasons(uuid) FROM PUBLIC, anon, authenticated;
SELECT public.seed_agent_status_reasons(id) FROM public.tenants;
CREATE OR REPLACE FUNCTION public.seed_agent_status_reasons_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM public.seed_agent_status_reasons(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER seed_agent_status_reasons_after_tenant AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.seed_agent_status_reasons_trg();

-- Cambia el estado; cierra el tramo anterior y abre uno nuevo de forma atómica.
CREATE OR REPLACE FUNCTION public.set_agent_status(_reason_id uuid, _user_id uuid DEFAULT NULL, _cause text DEFAULT 'manual') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _tenant uuid := public.get_user_tenant(_uid);
  _target uuid := coalesce(_user_id, _uid);
  _r public.agent_status_reasons;
  _cur public.agent_status_current;
BEGIN
  IF _uid IS NULL OR _tenant IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _target <> _uid AND NOT public.agent_status_is_supervisor(_uid,_tenant) THEN RAISE EXCEPTION 'Solo un supervisor puede cambiar el estado de otro asesor'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_target AND tenant_id=_tenant) THEN RAISE EXCEPTION 'El usuario no pertenece a la empresa'; END IF;
  SELECT * INTO _r FROM public.agent_status_reasons WHERE id=_reason_id AND tenant_id=_tenant AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  IF _cause NOT IN ('manual','logout','supervisor') THEN _cause := 'manual'; END IF;
  IF _target <> _uid THEN _cause := 'supervisor'; END IF;
  SELECT * INTO _cur FROM public.agent_status_current WHERE tenant_id=_tenant AND user_id=_target FOR UPDATE;
  IF FOUND AND _cur.reason_id = _r.id THEN
    UPDATE public.agent_status_current SET last_seen_at=now() WHERE tenant_id=_tenant AND user_id=_target;
    RETURN jsonb_build_object('changed', false);
  END IF;
  UPDATE public.agent_status_log SET ended_at=now(), ended_by=_uid, end_cause=_cause
    WHERE tenant_id=_tenant AND user_id=_target AND ended_at IS NULL;
  INSERT INTO public.agent_status_log (tenant_id,user_id,reason_id,kind,reason_name,started_at,set_by)
    VALUES (_tenant,_target,_r.id,_r.kind,_r.name,now(),_uid);
  INSERT INTO public.agent_status_current (tenant_id,user_id,reason_id,kind,reason_name,since,last_seen_at,set_by)
    VALUES (_tenant,_target,_r.id,_r.kind,_r.name,now(),now(),_uid)
    ON CONFLICT (tenant_id,user_id) DO UPDATE SET reason_id=EXCLUDED.reason_id, kind=EXCLUDED.kind, reason_name=EXCLUDED.reason_name, since=now(), last_seen_at=now(), set_by=_uid;
  RETURN jsonb_build_object('changed', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.set_agent_status(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_agent_status(uuid,uuid,text) TO authenticated;

-- Latido del navegador. Si se perdió más de 3 min, registra la desconexión real (desde el último latido).
CREATE OR REPLACE FUNCTION public.agent_status_heartbeat() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _tenant uuid := public.get_user_tenant(_uid);
  _cur public.agent_status_current;
  _off public.agent_status_reasons;
BEGIN
  IF _uid IS NULL OR _tenant IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _cur FROM public.agent_status_current WHERE tenant_id=_tenant AND user_id=_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','offline'); END IF;
  IF _cur.kind <> 'offline' AND _cur.last_seen_at < now() - interval '3 minutes' THEN
    SELECT * INTO _off FROM public.agent_status_reasons WHERE tenant_id=_tenant AND kind='offline' ORDER BY sort_order LIMIT 1;
    UPDATE public.agent_status_log SET ended_at=_cur.last_seen_at, end_cause='inactividad'
      WHERE tenant_id=_tenant AND user_id=_uid AND ended_at IS NULL;
    INSERT INTO public.agent_status_log (tenant_id,user_id,reason_id,kind,reason_name,started_at,ended_at,end_cause)
      VALUES (_tenant,_uid,_off.id,'offline',coalesce(_off.name,'Desconectado'),_cur.last_seen_at,now(),'reconexion');
    INSERT INTO public.agent_status_log (tenant_id,user_id,reason_id,kind,reason_name,started_at,set_by)
      VALUES (_tenant,_uid,_cur.reason_id,_cur.kind,_cur.reason_name,now(),_uid);
    UPDATE public.agent_status_current SET since=now(), last_seen_at=now() WHERE tenant_id=_tenant AND user_id=_uid;
    RETURN jsonb_build_object('kind',_cur.kind,'reconnected',true);
  END IF;
  UPDATE public.agent_status_current SET last_seen_at=now() WHERE tenant_id=_tenant AND user_id=_uid;
  RETURN jsonb_build_object('kind',_cur.kind);
END $$;
REVOKE EXECUTE ON FUNCTION public.agent_status_heartbeat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_status_heartbeat() TO authenticated;