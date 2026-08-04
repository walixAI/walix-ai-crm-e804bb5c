-- 1. Quitar el trigger duplicado de historial de etapas
DROP TRIGGER IF EXISTS trg_deals_stage_log ON public.deals;

-- 2. Permitir omitir la generación de gastos automáticos en cargas históricas
CREATE OR REPLACE FUNCTION public.generate_deal_expense_drafts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; v_amount NUMERIC;
BEGIN
  IF COALESCE(current_setting('app.skip_expense_drafts', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_won IS DISTINCT FROM true THEN RETURN NEW; END IF;
  ELSE
    IF NOT (NEW.is_won = true AND COALESCE(OLD.is_won, false) = false) THEN RETURN NEW; END IF;
  END IF;

  FOR r IN
    SELECT * FROM public.expense_rules
    WHERE tenant_id = NEW.tenant_id AND is_active = true
      AND (deal_type_filter IS NULL OR deal_type_filter = NEW.deal_type)
  LOOP
    v_amount := CASE r.rule_type
      WHEN 'percent_of_deal' THEN ROUND(COALESCE(NEW.amount,0) * r.value / 100.0, 2)
      WHEN 'fixed_per_deal'  THEN r.value
      WHEN 'percent_of_cost' THEN ROUND(COALESCE(NEW.cost_amount,0) * r.value / 100.0, 2)
    END;
    IF v_amount IS NULL OR v_amount <= 0 THEN CONTINUE; END IF;
    INSERT INTO public.expenses (
      tenant_id, owner_id, kind, category_id, amount, currency,
      incurred_at, deal_id, description, status, source, rule_id
    ) VALUES (
      NEW.tenant_id, NEW.owner_id, 'variable', r.category_id, v_amount, 'MXN',
      CURRENT_DATE, NEW.id, r.name || ' (auto por deal ganado)',
      CASE WHEN r.auto_confirm THEN 'confirmed' ELSE 'draft' END, 'rule', r.id
    );
  END LOOP;
  RETURN NEW;
END; $function$;

-- 3. Procesador de lotes de importación
CREATE OR REPLACE FUNCTION public.run_import_batch(_batch_id uuid, _historical boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  r record;
  d jsonb;
  v_contact uuid;
  v_deal uuid;
  v_act uuid;
  v_stage record;
  v_imported int := 0;
  v_skipped int := 0;
  v_errors int := 0;
BEGIN
  SELECT * INTO b FROM public.import_batches WHERE id = _batch_id;
  IF b IS NULL THEN
    RAISE EXCEPTION 'batch_not_found';
  END IF;

  IF _historical THEN
    PERFORM set_config('app.skip_expense_drafts', 'on', true);
  END IF;

  FOR r IN
    SELECT id, row_index, raw_data FROM public.import_rows
    WHERE batch_id = _batch_id AND status = 'pending'
    ORDER BY row_index
  LOOP
    d := r.raw_data;
    BEGIN
      IF b.kind = 'contacts' THEN
        SELECT c.id INTO v_contact FROM public.contacts c
        WHERE c.tenant_id = b.tenant_id AND c.phone = d->>'phone' LIMIT 1;

        IF v_contact IS NOT NULL THEN
          UPDATE public.import_rows SET status = 'skipped', error_message = 'Contacto duplicado' WHERE id = r.id;
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.contacts (
          tenant_id, owner_id, name, last_name, phone, phone_alt, email,
          company, address, source, status, custom_fields
        ) VALUES (
          b.tenant_id,
          NULLIF(d->>'owner_id','')::uuid,
          COALESCE(NULLIF(d->>'name',''), 'Sin nombre'),
          NULLIF(d->>'last_name',''),
          d->>'phone',
          NULLIF(d->>'phone_alt',''),
          NULLIF(d->>'email',''),
          NULLIF(d->>'company',''),
          NULLIF(d->>'address',''),
          COALESCE(NULLIF(d->>'source',''), 'Importación'),
          COALESCE(NULLIF(d->>'status','')::contact_lifecycle, 'prospecto'),
          COALESCE(d->'custom_fields', '{}'::jsonb)
        ) RETURNING id INTO v_contact;

        UPDATE public.import_rows
        SET status = 'imported', target_table = 'contacts', target_id = v_contact
        WHERE id = r.id;
        v_imported := v_imported + 1;

      ELSIF b.kind = 'deals' THEN
        SELECT c.id INTO v_contact FROM public.contacts c
        WHERE c.tenant_id = b.tenant_id AND c.phone = d->>'contact_phone' LIMIT 1;
        IF v_contact IS NULL THEN
          RAISE EXCEPTION 'Contacto no encontrado: %', d->>'contact_phone';
        END IF;

        SELECT ps.id, ps.name, ps.is_won, ps.is_lost INTO v_stage
        FROM public.pipeline_stages ps
        WHERE ps.id = NULLIF(d->>'stage_id','')::uuid AND ps.tenant_id = b.tenant_id;
        IF v_stage IS NULL THEN
          RAISE EXCEPTION 'Etapa inválida';
        END IF;

        INSERT INTO public.deals (
          tenant_id, contact_id, owner_id, name, amount, stage_id, stage_name,
          is_won, is_lost, expected_close_date, scheduled_at, notes,
          deal_type, service_type, equipment_model, source
        ) VALUES (
          b.tenant_id, v_contact,
          NULLIF(d->>'owner_id','')::uuid,
          COALESCE(NULLIF(d->>'name',''), 'Oportunidad importada'),
          COALESCE(NULLIF(d->>'amount','')::numeric, 0),
          v_stage.id, v_stage.name, v_stage.is_won, v_stage.is_lost,
          NULLIF(d->>'expected_close_date','')::date,
          NULLIF(d->>'scheduled_at','')::timestamptz,
          NULLIF(d->>'notes',''),
          NULLIF(d->>'deal_type',''),
          NULLIF(d->>'service_type',''),
          NULLIF(d->>'equipment_model',''),
          COALESCE(NULLIF(d->>'source',''), 'Importación')
        ) RETURNING id INTO v_deal;

        UPDATE public.import_rows
        SET status = 'imported', target_table = 'deals', target_id = v_deal
        WHERE id = r.id;
        v_imported := v_imported + 1;

      ELSIF b.kind = 'activities' THEN
        SELECT c.id INTO v_contact FROM public.contacts c
        WHERE c.tenant_id = b.tenant_id AND c.phone = d->>'contact_phone' LIMIT 1;
        IF v_contact IS NULL THEN
          RAISE EXCEPTION 'Contacto no encontrado: %', d->>'contact_phone';
        END IF;

        INSERT INTO public.activities (
          tenant_id, contact_id, type, description, occurred_at, metadata
        ) VALUES (
          b.tenant_id, v_contact,
          COALESCE(NULLIF(d->>'type','')::activity_type, 'note'),
          COALESCE(NULLIF(d->>'description',''), 'Actividad importada'),
          COALESCE(NULLIF(d->>'occurred_at','')::timestamptz, now()),
          COALESCE(d->'metadata', '{}'::jsonb)
        ) RETURNING id INTO v_act;

        UPDATE public.import_rows
        SET status = 'imported', target_table = 'activities', target_id = v_act
        WHERE id = r.id;
        v_imported := v_imported + 1;

      ELSIF b.kind = 'products' THEN
        INSERT INTO public.products (tenant_id, name, sku, price, category, description)
        VALUES (
          b.tenant_id,
          COALESCE(NULLIF(d->>'name',''), 'Producto importado'),
          NULLIF(d->>'sku',''),
          NULLIF(d->>'price','')::numeric,
          NULLIF(d->>'category',''),
          NULLIF(d->>'description','')
        ) RETURNING id INTO v_deal;

        UPDATE public.import_rows
        SET status = 'imported', target_table = 'products', target_id = v_deal
        WHERE id = r.id;
        v_imported := v_imported + 1;
      ELSE
        RAISE EXCEPTION 'Tipo de importe no soportado: %', b.kind;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.import_rows SET status = 'error', error_message = SQLERRM WHERE id = r.id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  PERFORM set_config('app.skip_expense_drafts', 'off', true);

  UPDATE public.import_batches
  SET status = 'done',
      imported_rows = COALESCE(imported_rows,0) + v_imported,
      skipped_rows = COALESCE(skipped_rows,0) + v_skipped,
      error_rows = COALESCE(error_rows,0) + v_errors,
      updated_at = now()
  WHERE id = _batch_id;

  RETURN jsonb_build_object('imported', v_imported, 'skipped', v_skipped, 'errors', v_errors);
END;
$function$;

REVOKE ALL ON FUNCTION public.run_import_batch(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_import_batch(uuid, boolean) TO authenticated, service_role;