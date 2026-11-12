ALTER TABLE public.deals ADD COLUMN lost_at timestamptz;
COMMENT ON COLUMN public.deals.lost_at IS 'Stable loss timestamp; historical unknown dates remain null rather than using last edit.';
CREATE OR REPLACE FUNCTION public.audit_sync_lost_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.is_lost THEN IF TG_OP='INSERT' THEN NEW.lost_at:=coalesce(NEW.lost_at,now()); ELSIF NOT coalesce(OLD.is_lost,false) THEN NEW.lost_at:=now(); ELSE NEW.lost_at:=OLD.lost_at; END IF; ELSE NEW.lost_at:=NULL; END IF; RETURN NEW; END $$;
CREATE TRIGGER audit_deals_lost_at BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.audit_sync_lost_at();
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE') AND p.proname <> 'get_invitation_public' LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',fn.proname,fn.args);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',fn.proname,fn.args);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.audit_protect_import_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF auth.role()='authenticated' THEN IF TG_OP='INSERT' THEN IF NEW.status IS DISTINCT FROM 'pending' OR NEW.target_id IS NOT NULL OR NEW.target_table IS NOT NULL THEN RAISE EXCEPTION 'Import results are server managed' USING ERRCODE='42501'; END IF; ELSE IF NEW.batch_id IS DISTINCT FROM OLD.batch_id OR NEW.status IS DISTINCT FROM OLD.status OR NEW.target_id IS DISTINCT FROM OLD.target_id OR NEW.target_table IS DISTINCT FROM OLD.target_table THEN RAISE EXCEPTION 'Import results are server managed' USING ERRCODE='42501'; END IF; END IF; END IF; RETURN NEW; END $$;
CREATE TRIGGER audit_import_results BEFORE INSERT OR UPDATE ON public.import_rows FOR EACH ROW EXECUTE FUNCTION public.audit_protect_import_row();