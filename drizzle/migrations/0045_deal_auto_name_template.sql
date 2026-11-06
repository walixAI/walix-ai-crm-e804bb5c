ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deal_name_template text;
COMMENT ON COLUMN public.tenants.deal_name_template IS 'NULL = default naming; category_frequency_month = "<Categoría> <N>M <Mes> <Año>" auto name, editable by advisor';

CREATE OR REPLACE FUNCTION public.deal_auto_name(_category text, _freq integer, _at timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(trim(_category),'')='' THEN NULL ELSE
    trim(
      CASE WHEN coalesce(_freq,0)>0 THEN regexp_replace(trim(_category),'\s+\d+\s*M$','','i') || ' ' || _freq || 'M'
           ELSE trim(_category) END
      || ' ' || (ARRAY['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'])[extract(month from (_at AT TIME ZONE 'America/Mexico_City'))::int]
      || ' ' || extract(year from (_at AT TIME ZONE 'America/Mexico_City'))::int
    ) END
$$;

CREATE OR REPLACE FUNCTION public.sync_opportunity_labels()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE s record; product_name text; old_product text; fields jsonb; vals jsonb; typed boolean; tmpl text; auto text;
BEGIN
 IF NEW.stage_id IS NOT NULL THEN SELECT name INTO s FROM public.pipeline_stages WHERE id=NEW.stage_id AND tenant_id=NEW.tenant_id; IF FOUND THEN NEW.stage_name:=s.name; END IF; END IF;
 typed := coalesce(trim(NEW.name),'')<>'' AND NEW.name NOT ILIKE 'Oportunidad%' AND NEW.name NOT ILIKE 'Prospecto%';

 -- Tenant-configured naming: "<Categoría> <N>M <Mes> <Año>"; advisor edits always win.
 SELECT deal_name_template INTO tmpl FROM public.tenants WHERE id=NEW.tenant_id;
 IF tmpl='category_frequency_month' AND NEW.product_category_id IS NOT NULL THEN
  SELECT name INTO product_name FROM public.product_categories WHERE id=NEW.product_category_id AND tenant_id=NEW.tenant_id;
  auto := public.deal_auto_name(product_name, NEW.service_frequency_months, coalesce(NEW.scheduled_at, NEW.created_at, now()));
  IF auto IS NOT NULL THEN
   IF TG_OP='INSERT' THEN
    IF typed AND NEW.name IS DISTINCT FROM product_name THEN RETURN NEW; END IF;
    NEW.name:=auto; NEW.profile_auto_name:=auto; RETURN NEW;
   END IF;
   IF NEW.name IS DISTINCT FROM OLD.name AND coalesce(trim(NEW.name),'')<>'' THEN RETURN NEW; END IF;
   IF NEW.product_category_id IS NOT DISTINCT FROM OLD.product_category_id
      AND NEW.service_frequency_months IS NOT DISTINCT FROM OLD.service_frequency_months
      AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at THEN RETURN NEW; END IF;
   SELECT name INTO old_product FROM public.product_categories WHERE id=OLD.product_category_id AND tenant_id=NEW.tenant_id;
   IF typed AND NEW.name IS DISTINCT FROM OLD.profile_auto_name AND NEW.name IS DISTINCT FROM old_product THEN RETURN NEW; END IF;
   NEW.name:=auto; NEW.profile_auto_name:=auto; RETURN NEW;
  END IF;
 END IF;

 IF TG_OP='UPDATE' THEN
  IF NEW.name IS DISTINCT FROM OLD.name AND coalesce(trim(NEW.name),'')<>'' THEN RETURN NEW; END IF;
  IF NEW.product_category_id IS NOT DISTINCT FROM OLD.product_category_id THEN RETURN NEW; END IF;
  SELECT name INTO old_product FROM public.product_categories WHERE id=OLD.product_category_id AND tenant_id=NEW.tenant_id;
  IF typed AND NEW.name IS DISTINCT FROM old_product AND NEW.name IS DISTINCT FROM OLD.profile_auto_name THEN RETURN NEW; END IF;
 END IF;
 IF TG_OP='INSERT' AND typed THEN RETURN NEW; END IF;
 SELECT name INTO product_name FROM public.product_categories WHERE id=NEW.product_category_id AND tenant_id=NEW.tenant_id;
 IF product_name IS NOT NULL THEN NEW.name:=product_name; RETURN NEW; END IF;
 SELECT custom_fields INTO fields FROM public.contacts WHERE id=NEW.contact_id AND tenant_id=NEW.tenant_id;
 vals:=public.profile_opportunity_values(NEW.tenant_id,fields);
 IF TG_OP='INSERT' AND coalesce(NEW.amount,0)=0 AND vals->>'amount' IS NOT NULL THEN NEW.amount:=(vals->>'amount')::numeric; NEW.profile_auto_amount:=NEW.amount; END IF;
 IF vals->>'name' IS NOT NULL THEN NEW.name:=vals->>'name'; NEW.profile_auto_name:=NEW.name; NEW.product_category_id:=coalesce((vals->>'category_id')::uuid,NEW.product_category_id); END IF;
 RETURN NEW;
END $function$;