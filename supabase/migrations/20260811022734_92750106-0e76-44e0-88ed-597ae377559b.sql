ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS service_frequency_months smallint;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_service_frequency_months_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_service_frequency_months_check
  CHECK (service_frequency_months IS NULL OR service_frequency_months IN (1,3,6,12,24));

-- Backfill desde nombre de categoría
UPDATE public.deals d
SET service_frequency_months = 6
FROM public.product_categories pc
WHERE pc.id = d.product_category_id
  AND d.service_frequency_months IS NULL
  AND pc.name ILIKE '%6M%';

UPDATE public.deals d
SET service_frequency_months = 12
FROM public.product_categories pc
WHERE pc.id = d.product_category_id
  AND d.service_frequency_months IS NULL
  AND pc.name ILIKE '%12M%';

-- Backfill desde recurrencias
UPDATE public.deals d
SET service_frequency_months = rd.period_months
FROM public.recurrence_occurrences ro
JOIN public.recurrence_definitions rd ON rd.id = ro.recurrence_id
WHERE ro.generated_deal_id = d.id
  AND d.service_frequency_months IS NULL
  AND rd.period_months IN (1,3,6,12,24);

-- Categoría general "Mantenimientos" por tenant que tenga categorías de mantenimiento
INSERT INTO public.product_categories (tenant_id, name)
SELECT DISTINCT pc.tenant_id, 'Mantenimientos'
FROM public.product_categories pc
WHERE pc.name ILIKE 'Mantenimiento%'
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Reasignar deals de las categorías 6M/12M a la general
UPDATE public.deals d
SET product_category_id = gen.id
FROM public.product_categories old
JOIN public.product_categories gen
  ON gen.tenant_id = old.tenant_id AND gen.name = 'Mantenimientos'
WHERE old.id = d.product_category_id
  AND old.name ILIKE 'Mantenimiento%'
  AND old.name <> 'Mantenimientos';

-- Desactivar duplicadas
UPDATE public.product_categories
SET is_active = false
WHERE name ILIKE 'Mantenimiento%' AND name <> 'Mantenimientos';

-- Renombrar cambio de filtro
UPDATE public.product_categories
SET name = 'Cambio de filtro'
WHERE name ILIKE 'Cambio de Filtro%'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_categories p2
    WHERE p2.tenant_id = product_categories.tenant_id AND p2.name = 'Cambio de filtro'
  );