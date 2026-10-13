ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS profile_auto_name text, ADD COLUMN IF NOT EXISTS profile_auto_amount numeric;

CREATE OR REPLACE FUNCTION public.profile_opportunity_values(p_tenant uuid, p_fields jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE program text; resolved_name text; category_id uuid; catalog_price numeric; explicit_amount text; resolved_amount numeric; matches integer;
BEGIN
  program := coalesce(nullif(trim(p_fields->>'licenciatura'),''), nullif(trim(p_fields->>'programa'),''), nullif(trim(p_fields->>'programa_interes'),''), nullif(trim(p_fields->>'programa_de_interes'),''), nullif(trim(p_fields->>'producto'),''));
  IF program IS NOT NULL THEN
    resolved_name := CASE WHEN nullif(trim(p_fields->>'licenciatura'),'') IS NOT NULL AND program NOT ILIKE 'Licenciatura%' THEN 'Licenciatura en ' || program ELSE program END;
    SELECT count(*), min(price) INTO matches, catalog_price FROM public.products
      WHERE tenant_id=p_tenant AND is_active AND lower(trim(name)) IN (lower(program), lower(resolved_name));
    IF matches <> 1 THEN catalog_price := NULL; END IF;
    SELECT CASE WHEN count(*)=1 THEN (array_agg(id))[1] ELSE NULL END INTO category_id FROM public.product_categories
      WHERE tenant_id=p_tenant AND is_active AND lower(trim(name)) IN (lower(program), lower(resolved_name));
  END IF;
  explicit_amount := coalesce(nullif(trim(p_fields->>'monto'),''),nullif(trim(p_fields->>'amount'),''),nullif(trim(p_fields->>'precio_confirmado'),''),nullif(trim(p_fields->>'valor_oportunidad'),''));
  -- Accept only an unambiguous numeric amount, never budgets, introductory offers or prose.
  IF explicit_amount ~ '^[0-9]+([.][0-9]{1,2})?$' AND length(explicit_amount)<16 THEN resolved_amount := explicit_amount::numeric;
  ELSE resolved_amount := catalog_price; END IF;
  RETURN jsonb_build_object('name',resolved_name,'category_id',category_id,'amount',resolved_amount);
END $$;
REVOKE ALL ON FUNCTION public.profile_opportunity_values(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_opportunity_values(uuid,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.refresh_contact_opportunity_names()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d record; vals jsonb; previous_vals jsonb; next_name text; next_amount numeric; next_category uuid; category_name text;
BEGIN
  IF NEW.custom_fields IS NOT DISTINCT FROM OLD.custom_fields THEN RETURN NEW; END IF;
  vals := public.profile_opportunity_values(NEW.tenant_id,NEW.custom_fields);
  previous_vals := public.profile_opportunity_values(OLD.tenant_id,OLD.custom_fields);
  IF vals IS NOT DISTINCT FROM previous_vals THEN RETURN NEW; END IF;
  -- Profile updates only affect the latest open opportunity; closed/historical deals stay untouched.
  SELECT * INTO d FROM public.deals WHERE contact_id=NEW.id AND tenant_id=NEW.tenant_id
    AND NOT is_won AND NOT is_lost ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  next_name := vals->>'name'; next_amount := (vals->>'amount')::numeric; next_category := (vals->>'category_id')::uuid;
  SELECT name INTO category_name FROM public.product_categories WHERE id=d.product_category_id AND tenant_id=NEW.tenant_id;
  -- Once an advisor overrides an automatically filled value, retain that override.
  IF next_name IS NULL OR NOT (
    d.name IS NOT DISTINCT FROM d.profile_auto_name OR nullif(trim(d.name),'') IS NULL
    OR d.name IN (NEW.name,OLD.name,category_name,previous_vals->>'name')
    OR d.name ILIKE 'Oportunidad%' OR d.name ILIKE 'Prospecto%'
  ) THEN next_name := NULL; END IF;
  IF next_amount IS NULL OR NOT (coalesce(d.amount,0)=0 OR d.amount IS NOT DISTINCT FROM d.profile_auto_amount) THEN next_amount := NULL; END IF;
  UPDATE public.deals SET
    name=coalesce(next_name,name), profile_auto_name=coalesce(next_name,profile_auto_name),
    amount=coalesce(next_amount,amount), profile_auto_amount=coalesce(next_amount,profile_auto_amount),
    product_category_id=CASE WHEN next_name IS NOT NULL THEN coalesce(next_category,product_category_id) ELSE product_category_id END,
    updated_at=now()
  WHERE id=d.id AND tenant_id=NEW.tenant_id AND (next_name IS NOT NULL OR next_amount IS NOT NULL);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_opportunity_labels()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s record; product_name text; fields jsonb; vals jsonb;
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT name INTO s FROM public.pipeline_stages WHERE id=NEW.stage_id AND tenant_id=NEW.tenant_id;
    IF FOUND THEN NEW.stage_name := s.name; END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.name IS DISTINCT FROM OLD.name AND coalesce(trim(NEW.name),'')<>'' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.product_category_id IS NOT DISTINCT FROM OLD.product_category_id THEN RETURN NEW; END IF;
  SELECT name INTO product_name FROM public.product_categories WHERE id=NEW.product_category_id AND tenant_id=NEW.tenant_id;
  SELECT custom_fields INTO fields FROM public.contacts WHERE id=NEW.contact_id AND tenant_id=NEW.tenant_id;
  vals := public.profile_opportunity_values(NEW.tenant_id,fields);
  IF TG_OP='INSERT' AND coalesce(NEW.amount,0)=0 AND vals->>'amount' IS NOT NULL THEN
    NEW.amount := (vals->>'amount')::numeric; NEW.profile_auto_amount := NEW.amount;
  END IF;
  IF vals->>'name' IS NOT NULL AND (product_name IS NULL OR product_name ILIKE 'Licenciatura%' OR lower(product_name)=lower(vals->>'name')) THEN
    NEW.name := vals->>'name'; NEW.profile_auto_name := NEW.name;
    NEW.product_category_id := coalesce((vals->>'category_id')::uuid,NEW.product_category_id);
  ELSIF product_name IS NOT NULL THEN NEW.name := product_name;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON COLUMN public.deals.profile_auto_name IS 'Last profile-derived name; preserves advisor overrides on subsequent profiling turns.';
COMMENT ON COLUMN public.deals.profile_auto_amount IS 'Last confirmed profile/catalog amount; preserves advisor overrides and never infers a price from promotional text.';