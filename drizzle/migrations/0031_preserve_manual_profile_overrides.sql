CREATE OR REPLACE FUNCTION public.refresh_contact_opportunity_names()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d record; vals jsonb; previous_vals jsonb; next_name text; next_amount numeric; next_category uuid; category_name text;
BEGIN
  IF NEW.custom_fields IS NOT DISTINCT FROM OLD.custom_fields THEN RETURN NEW; END IF;
  vals := public.profile_opportunity_values(NEW.tenant_id,NEW.custom_fields);
  previous_vals := public.profile_opportunity_values(OLD.tenant_id,OLD.custom_fields);
  IF vals IS NOT DISTINCT FROM previous_vals THEN RETURN NEW; END IF;
  SELECT * INTO d FROM public.deals WHERE contact_id=NEW.id AND tenant_id=NEW.tenant_id
    AND NOT is_won AND NOT is_lost ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  next_name := vals->>'name'; next_amount := (vals->>'amount')::numeric; next_category := (vals->>'category_id')::uuid;
  SELECT name INTO category_name FROM public.product_categories WHERE id=d.product_category_id AND tenant_id=NEW.tenant_id;
  IF next_name IS NULL OR NOT coalesce((
    d.name IS NOT DISTINCT FROM d.profile_auto_name OR nullif(trim(d.name),'') IS NULL
    OR d.name IN (NEW.name,OLD.name,category_name,previous_vals->>'name')
    OR d.name ILIKE 'Oportunidad%' OR d.name ILIKE 'Prospecto%'
  ),false) THEN next_name := NULL; END IF;
  IF next_amount IS NULL OR NOT (coalesce(d.amount,0)=0 OR d.amount IS NOT DISTINCT FROM d.profile_auto_amount) THEN next_amount := NULL; END IF;
  UPDATE public.deals SET name=coalesce(next_name,name), profile_auto_name=coalesce(next_name,profile_auto_name),
    amount=coalesce(next_amount,amount), profile_auto_amount=coalesce(next_amount,profile_auto_amount),
    product_category_id=CASE WHEN next_name IS NOT NULL THEN coalesce(next_category,product_category_id) ELSE product_category_id END,
    updated_at=now()
  WHERE id=d.id AND tenant_id=NEW.tenant_id AND (next_name IS NOT NULL OR next_amount IS NOT NULL);
  RETURN NEW;
END $$;