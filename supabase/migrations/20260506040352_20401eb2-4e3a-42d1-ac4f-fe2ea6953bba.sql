
-- ============ contact_stages ============
CREATE TABLE public.contact_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'hsl(220 13% 65%)',
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
ALTER TABLE public.contact_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select contact_stages" ON public.contact_stages
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid()));
CREATE POLICY "admin insert contact_stages" ON public.contact_stages
  FOR INSERT WITH CHECK (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))
    )
  );
CREATE POLICY "admin update contact_stages" ON public.contact_stages
  FOR UPDATE USING (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))
    )
  );
CREATE POLICY "admin delete contact_stages" ON public.contact_stages
  FOR DELETE USING (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))
    )
  );
CREATE TRIGGER trg_contact_stages_updated BEFORE UPDATE ON public.contact_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ contact_sources ============
CREATE TABLE public.contact_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
ALTER TABLE public.contact_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select contact_sources" ON public.contact_sources
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid()));
CREATE POLICY "admin insert contact_sources" ON public.contact_sources
  FOR INSERT WITH CHECK (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))
    )
  );
CREATE POLICY "admin update contact_sources" ON public.contact_sources
  FOR UPDATE USING (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))
    )
  );
CREATE POLICY "admin delete contact_sources" ON public.contact_sources
  FOR DELETE USING (
    is_platform(auth.uid()) OR (
      tenant_id = get_user_tenant(auth.uid())
      AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))
    )
  );
CREATE TRIGGER trg_contact_sources_updated BEFORE UPDATE ON public.contact_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ companies ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  website text,
  industry text,
  size text,
  phone text,
  email text,
  address text,
  notes text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select companies" ON public.companies
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_platform(auth.uid()));
CREATE POLICY "tenant insert companies" ON public.companies
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "tenant update companies" ON public.companies
  FOR UPDATE USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete companies" ON public.companies
  FOR DELETE USING (tenant_id = get_user_tenant(auth.uid()));
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_companies_tenant_name ON public.companies (tenant_id, lower(name));

-- ============ contacts: nuevas FKs y phone nullable ============
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS stage_id uuid,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ALTER COLUMN phone DROP NOT NULL;

-- ============ activities: updated_at + metadata ============
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Seed defaults para tenants existentes ============
INSERT INTO public.contact_stages (tenant_id, name, color, position, is_default, is_won, is_lost)
SELECT t.id, v.name, v.color, v.pos, v.is_default, v.is_won, v.is_lost
FROM public.tenants t
CROSS JOIN (VALUES
  ('Nuevo',          'hsl(210 90% 55%)', 0, true,  false, false),
  ('Contactado',     'hsl(38 92% 50%)',  1, false, false, false),
  ('Calificado',     'hsl(270 70% 60%)', 2, false, false, false),
  ('En negociación', 'hsl(25 95% 55%)',  3, false, false, false),
  ('Cliente',        'hsl(142 70% 45%)', 4, false, true,  false),
  ('Inactivo',       'hsl(220 9% 55%)',  5, false, false, true)
) AS v(name, color, pos, is_default, is_won, is_lost)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.contact_sources (tenant_id, name, icon, position)
SELECT t.id, v.name, v.icon, v.pos
FROM public.tenants t
CROSS JOIN (VALUES
  ('WhatsApp',       'message-circle', 0),
  ('Formulario web', 'globe',          1),
  ('Referido',       'users',          2),
  ('Manual',         'pencil',         3)
) AS v(name, icon, pos)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Backfill stage_id / source_id en contactos existentes
UPDATE public.contacts c
SET stage_id = s.id
FROM public.contact_stages s
WHERE s.tenant_id = c.tenant_id AND s.name = c.status::text AND c.stage_id IS NULL;

UPDATE public.contacts c
SET source_id = s.id
FROM public.contact_sources s
WHERE s.tenant_id = c.tenant_id AND s.name = c.source::text AND c.source_id IS NULL;

-- Backfill companies desde contacts.company
INSERT INTO public.companies (tenant_id, name)
SELECT DISTINCT c.tenant_id, btrim(c.company)
FROM public.contacts c
WHERE c.company IS NOT NULL AND btrim(c.company) <> ''
ON CONFLICT DO NOTHING;

UPDATE public.contacts c
SET company_id = co.id
FROM public.companies co
WHERE co.tenant_id = c.tenant_id
  AND lower(co.name) = lower(btrim(c.company))
  AND c.company_id IS NULL
  AND c.company IS NOT NULL;

-- ============ Trigger seed para tenants nuevos ============
CREATE OR REPLACE FUNCTION public.seed_tenant_contact_catalogs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contact_stages (tenant_id, name, color, position, is_default, is_won, is_lost) VALUES
    (NEW.id, 'Nuevo',          'hsl(210 90% 55%)', 0, true,  false, false),
    (NEW.id, 'Contactado',     'hsl(38 92% 50%)',  1, false, false, false),
    (NEW.id, 'Calificado',     'hsl(270 70% 60%)', 2, false, false, false),
    (NEW.id, 'En negociación', 'hsl(25 95% 55%)',  3, false, false, false),
    (NEW.id, 'Cliente',        'hsl(142 70% 45%)', 4, false, true,  false),
    (NEW.id, 'Inactivo',       'hsl(220 9% 55%)',  5, false, false, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.contact_sources (tenant_id, name, icon, position) VALUES
    (NEW.id, 'WhatsApp',       'message-circle', 0),
    (NEW.id, 'Formulario web', 'globe',          1),
    (NEW.id, 'Referido',       'users',          2),
    (NEW.id, 'Manual',         'pencil',         3)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tenant_catalogs ON public.tenants;
CREATE TRIGGER trg_seed_tenant_catalogs AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_tenant_contact_catalogs();
