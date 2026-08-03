-- 1. Catálogo de bloqueos (lead vivo pero detenido)
CREATE TABLE public.deal_blockers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  default_resolution_days INTEGER NOT NULL DEFAULT 7,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_blockers TO authenticated;
GRANT ALL ON public.deal_blockers TO service_role;

ALTER TABLE public.deal_blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_blockers_select" ON public.deal_blockers
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

CREATE POLICY "deal_blockers_insert" ON public.deal_blockers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "deal_blockers_update" ON public.deal_blockers
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "deal_blockers_delete" ON public.deal_blockers
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TRIGGER trg_deal_blockers_updated_at
  BEFORE UPDATE ON public.deal_blockers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_deal_blockers_tenant ON public.deal_blockers(tenant_id, position);

-- 2. Catálogo de motivos de pérdida
CREATE TABLE public.deal_loss_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_loss_reasons TO authenticated;
GRANT ALL ON public.deal_loss_reasons TO service_role;

ALTER TABLE public.deal_loss_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_loss_reasons_select" ON public.deal_loss_reasons
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));

CREATE POLICY "deal_loss_reasons_insert" ON public.deal_loss_reasons
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "deal_loss_reasons_update" ON public.deal_loss_reasons
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "deal_loss_reasons_delete" ON public.deal_loss_reasons
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TRIGGER trg_deal_loss_reasons_updated_at
  BEFORE UPDATE ON public.deal_loss_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_deal_loss_reasons_tenant ON public.deal_loss_reasons(tenant_id, position);

-- 3. Estado vigente en deals
ALTER TABLE public.deals
  ADD COLUMN current_blocker_id UUID REFERENCES public.deal_blockers(id) ON DELETE SET NULL,
  ADD COLUMN blocker_set_at TIMESTAMPTZ,
  ADD COLUMN blocker_expected_at DATE,
  ADD COLUMN blocker_note TEXT,
  ADD COLUMN loss_reason_id UUID REFERENCES public.deal_loss_reasons(id) ON DELETE SET NULL,
  ADD COLUMN last_inbound_at TIMESTAMPTZ,
  ADD COLUMN no_response_since TIMESTAMPTZ,
  ADD COLUMN last_known_blocker_id UUID REFERENCES public.deal_blockers(id) ON DELETE SET NULL;

CREATE INDEX idx_deals_blocker ON public.deals(tenant_id, current_blocker_id) WHERE current_blocker_id IS NOT NULL;
CREATE INDEX idx_deals_no_response ON public.deals(tenant_id, no_response_since) WHERE no_response_since IS NOT NULL;

-- 4. Umbral de silencio por tenant
ALTER TABLE public.tenants
  ADD COLUMN no_response_days INTEGER NOT NULL DEFAULT 10;

-- 5. Semillas
CREATE OR REPLACE FUNCTION public.seed_default_deal_diagnostics(_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deal_blockers (tenant_id, label, description, default_resolution_days, position)
  SELECT _tenant_id, v.label, v.description, v.days, v.pos
  FROM (VALUES
    ('Evaluando otros proveedores', 'Está comparando nuestra propuesta contra la competencia', 7, 1),
    ('Esperando aprobación interna', 'Necesita el visto bueno de su jefe o de otra área', 7, 2),
    ('Esperando presupuesto', 'No tiene recursos liberados todavía', 15, 3),
    ('Revisando la propuesta técnica', 'Está validando alcance, especificaciones o compatibilidad', 5, 4),
    ('Pidió contactarlo después', 'No es el momento, solicitó posponer la conversación', 15, 5),
    ('Precio en revisión', 'Le pareció alto o pidió descuento y está en negociación', 5, 6)
  ) AS v(label, description, days, pos)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deal_blockers b WHERE b.tenant_id = _tenant_id AND b.label = v.label
  );

  INSERT INTO public.deal_loss_reasons (tenant_id, label, description, position)
  SELECT _tenant_id, v.label, v.description, v.pos
  FROM (VALUES
    ('Precio alto', 'Nuestro precio quedó fuera de lo que estaba dispuesto a pagar', 1),
    ('No cubre su necesidad', 'El producto o servicio no resuelve lo que buscaba', 2),
    ('Compró con la competencia', 'Eligió a otro proveedor', 3),
    ('Sin presupuesto', 'No tiene ni tendrá recursos en el corto plazo', 4),
    ('Ya no responde', 'Dejó de contestar y no fue posible retomar el contacto', 5),
    ('Ya no es el momento', 'Pospuso la decisión indefinidamente', 6)
  ) AS v(label, description, pos)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deal_loss_reasons r WHERE r.tenant_id = _tenant_id AND r.label = v.label
  );
END;
$$;

-- Semilla para tenants existentes
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_deal_diagnostics(t.id);
  END LOOP;
END;
$$;

-- Semilla automática para tenants nuevos
CREATE OR REPLACE FUNCTION public.trg_seed_deal_diagnostics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_deal_diagnostics(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_seed_deal_diagnostics
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_deal_diagnostics();

-- 6. Registrar última respuesta entrante del cliente
CREATE OR REPLACE FUNCTION public.trg_deal_last_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL
     AND (NEW.type IN ('wa_received') OR COALESCE(NEW.metadata->>'direction','') = 'in') THEN
    UPDATE public.deals
       SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, NEW.occurred_at), NEW.occurred_at),
           no_response_since = NULL
     WHERE id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activities_deal_last_inbound
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.trg_deal_last_inbound();

-- 7. Rutina de silencio inferido
CREATE OR REPLACE FUNCTION public.mark_silent_deals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  WITH upd AS (
    UPDATE public.deals d
       SET no_response_since = now(),
           last_known_blocker_id = COALESCE(d.last_known_blocker_id, d.current_blocker_id)
      FROM public.tenants t
     WHERE d.tenant_id = t.id
       AND d.is_won = false
       AND d.is_lost = false
       AND d.no_response_since IS NULL
       AND COALESCE(d.last_inbound_at, d.created_at) < now() - make_interval(days => COALESCE(t.no_response_days, 10))
    RETURNING d.id
  )
  SELECT count(*) INTO affected FROM upd;
  RETURN affected;
END;
$$;

SELECT cron.schedule(
  'mark-silent-deals-daily',
  '15 8 * * *',
  $$SELECT public.mark_silent_deals();$$
);