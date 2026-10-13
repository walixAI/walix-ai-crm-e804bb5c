CREATE OR REPLACE FUNCTION public.sync_opportunity_labels()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE s record; product_name text; fields jsonb; program text;
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT name INTO s FROM public.pipeline_stages WHERE id=NEW.stage_id AND tenant_id=NEW.tenant_id;
    IF FOUND THEN NEW.stage_name := s.name; END IF;
  END IF;
  -- Respect a manual rename by the advisor
  IF TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name AND coalesce(trim(NEW.name),'') <> '' THEN
    RETURN NEW;
  END IF;
  -- Only auto-name on insert or when product changes / contact program refresh (name=name)
  IF TG_OP = 'UPDATE' AND NEW.product_category_id IS NOT DISTINCT FROM OLD.product_category_id
     AND current_setting('walix.refresh_names', true) IS DISTINCT FROM 'on' THEN
    RETURN NEW;
  END IF;
  SELECT name INTO product_name FROM public.product_categories WHERE id=NEW.product_category_id AND tenant_id=NEW.tenant_id;
  SELECT custom_fields INTO fields FROM public.contacts WHERE id=NEW.contact_id AND tenant_id=NEW.tenant_id;
  program := nullif(trim(fields->>'licenciatura'),'');
  IF program IS NOT NULL AND (product_name IS NULL OR product_name ILIKE 'Licenciatura%') THEN
    NEW.name := CASE WHEN program ILIKE 'Licenciatura%' THEN program ELSE 'Licenciatura en ' || program END;
  ELSIF product_name IS NOT NULL THEN NEW.name := product_name;
  END IF;
  RETURN NEW;
END $function$;