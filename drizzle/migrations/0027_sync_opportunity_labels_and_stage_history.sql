CREATE OR REPLACE FUNCTION public.sync_opportunity_labels() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s record; product_name text; fields jsonb; program text;
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT name INTO s FROM public.pipeline_stages WHERE id=NEW.stage_id AND tenant_id=NEW.tenant_id;
    IF FOUND THEN NEW.stage_name := s.name; END IF;
  END IF;
  SELECT name INTO product_name FROM public.product_categories WHERE id=NEW.product_category_id AND tenant_id=NEW.tenant_id;
  SELECT custom_fields INTO fields FROM public.contacts WHERE id=NEW.contact_id AND tenant_id=NEW.tenant_id;
  program := nullif(trim(fields->>'licenciatura'),'');
  IF program IS NOT NULL AND (product_name IS NULL OR product_name ILIKE 'Licenciatura%') THEN
    NEW.name := CASE WHEN program ILIKE 'Licenciatura%' THEN program ELSE 'Licenciatura en ' || program END;
  ELSIF product_name IS NOT NULL THEN NEW.name := product_name;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_opportunity_labels BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.sync_opportunity_labels();

CREATE OR REPLACE FUNCTION public.refresh_contact_opportunity_names() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.custom_fields IS DISTINCT FROM OLD.custom_fields THEN
    UPDATE public.deals SET name=name WHERE contact_id=NEW.id AND tenant_id=NEW.tenant_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER refresh_contact_opportunity_names AFTER UPDATE OF custom_fields ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.refresh_contact_opportunity_names();

CREATE OR REPLACE FUNCTION public.log_deal_stage_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_event text; v_rule text; v_metadata jsonb; v_actor text;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN RETURN NEW; END IF;
  END IF;
  v_event := nullif(current_setting('app.auto_stage_event',true),'');
  v_rule := nullif(current_setting('app.auto_stage_rule_id',true),'');
  SELECT full_name INTO v_actor FROM public.profiles WHERE id=auth.uid();
  v_metadata := jsonb_strip_nulls(jsonb_build_object('automatic',v_event IS NOT NULL OR v_rule IS NOT NULL,'event',v_event,'rule_id',v_rule,'changed_by_name',v_actor));
  IF TG_OP='INSERT' THEN
    INSERT INTO public.deal_stage_history(tenant_id,deal_id,to_stage_id,to_stage_name,changed_by,metadata)
    VALUES(NEW.tenant_id,NEW.id,NEW.stage_id,NEW.stage_name,auth.uid(),v_metadata);
  ELSE
    INSERT INTO public.deal_stage_history(tenant_id,deal_id,from_stage_id,to_stage_id,from_stage_name,to_stage_name,changed_by,metadata)
    VALUES(NEW.tenant_id,NEW.id,OLD.stage_id,NEW.stage_id,OLD.stage_name,NEW.stage_name,auth.uid(),v_metadata);
  END IF;
  RETURN NEW;
END $$;