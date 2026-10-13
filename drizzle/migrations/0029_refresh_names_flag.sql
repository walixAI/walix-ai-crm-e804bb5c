CREATE OR REPLACE FUNCTION public.refresh_contact_opportunity_names()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.custom_fields IS DISTINCT FROM OLD.custom_fields
     AND (NEW.custom_fields->>'licenciatura') IS DISTINCT FROM (OLD.custom_fields->>'licenciatura') THEN
    PERFORM set_config('walix.refresh_names','on',true);
    UPDATE public.deals SET name=name WHERE contact_id=NEW.id AND tenant_id=NEW.tenant_id;
    PERFORM set_config('walix.refresh_names','off',true);
  END IF;
  RETURN NEW;
END $function$;