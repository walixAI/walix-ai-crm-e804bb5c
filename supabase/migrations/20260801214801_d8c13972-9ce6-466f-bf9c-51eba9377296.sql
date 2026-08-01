-- Ajustes configurables por tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS contact_inactivity_days integer DEFAULT 90,
  ADD COLUMN IF NOT EXISTS customer_inactivity_months integer DEFAULT 6;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_contact_inactivity_days_check
    CHECK (contact_inactivity_days IN (30, 90, 120, 150, 180)),
  ADD CONSTRAINT tenants_customer_inactivity_months_check
    CHECK (customer_inactivity_months IN (3, 6, 9, 12));

-- Nuevo enum de ciclo de vida del contacto
CREATE TYPE public.contact_lifecycle AS ENUM ('prospecto', 'cliente', 'cliente_inactivo', 'inactivo');

-- Migrar contacts.status de lead_status a contact_lifecycle
ALTER TABLE public.contacts
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.contact_lifecycle
    USING CASE status
      WHEN 'Nuevo' THEN 'prospecto'::public.contact_lifecycle
      WHEN 'Contactado' THEN 'prospecto'::public.contact_lifecycle
      WHEN 'Calificado' THEN 'prospecto'::public.contact_lifecycle
      WHEN 'En negociación' THEN 'prospecto'::public.contact_lifecycle
      WHEN 'Cliente' THEN 'cliente'::public.contact_lifecycle
      WHEN 'Inactivo' THEN 'inactivo'::public.contact_lifecycle
      ELSE 'prospecto'::public.contact_lifecycle
    END,
  ALTER COLUMN status SET DEFAULT 'prospecto'::public.contact_lifecycle;

-- Contactos con deals ganados pasan a cliente
UPDATE public.contacts c
SET status = 'cliente'::public.contact_lifecycle
WHERE EXISTS (
  SELECT 1 FROM public.deals d
  WHERE d.contact_id = c.id AND d.is_won = true
);

-- Eliminar columna stage_id y tabla contact_stages
ALTER TABLE public.contacts DROP COLUMN IF EXISTS stage_id;
DROP TABLE IF EXISTS public.contact_stages CASCADE;

-- Eliminar enum obsoleto
DROP TYPE IF EXISTS public.lead_status CASCADE;

-- Actualizar trigger de catálogos del tenant (sin contact_stages)
CREATE OR REPLACE FUNCTION public.seed_tenant_contact_catalogs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.contact_sources (tenant_id, name, icon, position) VALUES
    (NEW.id, 'WhatsApp',       'message-circle', 0),
    (NEW.id, 'Formulario web', 'globe',          1),
    (NEW.id, 'Referido',       'users',          2),
    (NEW.id, 'Manual',         'pencil',         3)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Grant explícito para la tabla tenants (ya existe, se mantiene idempotente)
GRANT SELECT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;