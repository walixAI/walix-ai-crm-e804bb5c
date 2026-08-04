-- 1. plan_limits: nuevas columnas y precios
ALTER TABLE public.plan_limits
  ADD COLUMN IF NOT EXISTS annual_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_ai_vendors text[] NOT NULL DEFAULT ARRAY['gemini']::text[];

UPDATE public.plan_limits SET monthly_price = 899, annual_price = 719, whatsapp_credits = 100, ai_credits = 1000,
  allowed_ai_vendors = ARRAY['gemini']::text[] WHERE plan = 'pyme';
UPDATE public.plan_limits SET monthly_price = 1499, annual_price = 1199, whatsapp_credits = 150, ai_credits = 4000,
  allowed_ai_vendors = ARRAY['gemini','openai']::text[] WHERE plan = 'growth';
UPDATE public.plan_limits SET monthly_price = 2500, annual_price = 2000, whatsapp_credits = 250, ai_credits = 10000,
  allowed_ai_vendors = ARRAY['gemini','openai','anthropic']::text[] WHERE plan = 'enterprise';

-- migrar tenants starter -> pyme con trial de 14 dias
UPDATE public.tenants
SET plan = 'pyme',
    trial_ends_at = COALESCE(trial_ends_at, now() + interval '14 days')
WHERE plan = 'starter';

DELETE FROM public.plan_limits WHERE plan = 'starter';

-- 2. Catalogo de modelos de IA
CREATE TABLE IF NOT EXISTS public.ai_model_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor text NOT NULL,
  model_id text NOT NULL UNIQUE,
  commercial_name text NOT NULL,
  credit_factor numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_model_catalog TO authenticated;
GRANT ALL ON public.ai_model_catalog TO service_role;
ALTER TABLE public.ai_model_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_model_catalog_read" ON public.ai_model_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_model_catalog_platform_write" ON public.ai_model_catalog
  FOR ALL TO authenticated USING (public.is_platform(auth.uid())) WITH CHECK (public.is_platform(auth.uid()));

CREATE TRIGGER trg_ai_model_catalog_updated_at BEFORE UPDATE ON public.ai_model_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_model_catalog (vendor, model_id, commercial_name, credit_factor, sort_order) VALUES
  ('gemini', 'google/gemini-3.1-flash-lite', 'Walix IA · Estándar', 1, 10),
  ('gemini', 'google/gemini-3.6-flash', 'Walix IA · Avanzado', 2, 20),
  ('gemini', 'google/gemini-3.1-pro-preview', 'Walix IA · Premium', 8, 30),
  ('openai', 'openai/gpt-5.4-mini', 'Walix IA · Avanzado (O)', 2, 40),
  ('openai', 'openai/gpt-5.4', 'Walix IA · Premium (O)', 6, 50),
  ('anthropic', 'anthropic/claude-standard', 'Walix IA · Premium (C)', 4, 60)
ON CONFLICT (model_id) DO NOTHING;

-- 3. Motor de IA por tenant (solo plataforma escribe)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ai_vendor text NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'google/gemini-3.1-flash-lite';

UPDATE public.tenants SET ai_vendor = 'gemini', ai_model = 'google/gemini-3.1-flash-lite';

CREATE OR REPLACE FUNCTION public.protect_tenant_ai_model()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.ai_vendor IS DISTINCT FROM OLD.ai_vendor OR NEW.ai_model IS DISTINCT FROM OLD.ai_model)
     AND NOT public.is_platform(auth.uid()) THEN
    RAISE EXCEPTION 'Solo la plataforma Walix puede cambiar el modelo de IA';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_tenant_ai_model ON public.tenants;
CREATE TRIGGER trg_protect_tenant_ai_model BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_ai_model();

-- 4. Solicitudes de cambio de modelo
CREATE TABLE IF NOT EXISTS public.ai_model_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_vendor text NOT NULL,
  requested_model text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_model_change_requests TO authenticated;
GRANT UPDATE, DELETE ON public.ai_model_change_requests TO authenticated;
GRANT ALL ON public.ai_model_change_requests TO service_role;
ALTER TABLE public.ai_model_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amcr_select_own_tenant" ON public.ai_model_change_requests
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "amcr_insert_own_tenant" ON public.ai_model_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND requested_by = auth.uid() AND status = 'pending');
CREATE POLICY "amcr_platform_update" ON public.ai_model_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_platform(auth.uid())) WITH CHECK (public.is_platform(auth.uid()));
CREATE POLICY "amcr_platform_delete" ON public.ai_model_change_requests
  FOR DELETE TO authenticated USING (public.is_platform(auth.uid()));

CREATE TRIGGER trg_amcr_updated_at BEFORE UPDATE ON public.ai_model_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Paquetes adicionales de creditos
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL,
  name text NOT NULL,
  credits integer NOT NULL,
  price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_packs TO authenticated;
GRANT SELECT ON public.credit_packs TO anon;
GRANT ALL ON public.credit_packs TO service_role;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_packs_read" ON public.credit_packs FOR SELECT USING (true);
CREATE POLICY "credit_packs_platform_write" ON public.credit_packs
  FOR ALL TO authenticated USING (public.is_platform(auth.uid())) WITH CHECK (public.is_platform(auth.uid()));

CREATE TRIGGER trg_credit_packs_updated_at BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.credit_packs (code, kind, name, credits, price, sort_order) VALUES
  ('WA_100',  'whatsapp', 'WhatsApp 100',   100,   390, 10),
  ('WA_500',  'whatsapp', 'WhatsApp 500',   500,  1750, 20),
  ('WA_1000', 'whatsapp', 'WhatsApp 1,000', 1000, 3200, 30),
  ('AI_2K',   'ai',       'IA 2K',          2000,  349, 40),
  ('AI_5K',   'ai',       'IA 5K',          5000,  749, 50),
  ('AI_15K',  'ai',       'IA 15K',        15000, 1890, 60)
ON CONFLICT (code) DO NOTHING;

-- 6. Saldos de creditos por tenant y periodo
CREATE TABLE IF NOT EXISTS public.tenant_credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  whatsapp_included integer NOT NULL DEFAULT 0,
  whatsapp_purchased integer NOT NULL DEFAULT 0,
  whatsapp_used integer NOT NULL DEFAULT 0,
  ai_included integer NOT NULL DEFAULT 0,
  ai_purchased integer NOT NULL DEFAULT 0,
  ai_used numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start)
);

GRANT SELECT ON public.tenant_credit_balances TO authenticated;
GRANT ALL ON public.tenant_credit_balances TO service_role;
ALTER TABLE public.tenant_credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tcb_select_own_tenant" ON public.tenant_credit_balances
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "tcb_platform_write" ON public.tenant_credit_balances
  FOR ALL TO authenticated USING (public.is_platform(auth.uid())) WITH CHECK (public.is_platform(auth.uid()));

CREATE TRIGGER trg_tcb_updated_at BEFORE UPDATE ON public.tenant_credit_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Refrigeracion G&R -> Enterprise
UPDATE public.tenants SET plan = 'enterprise', mrr = 2500, status = 'active', trial_ends_at = NULL
WHERE id = '6d0ad953-4ee0-4e5f-b2b1-27c7f3f4a37c'
   OR name ILIKE '%Refrigeraci%';
