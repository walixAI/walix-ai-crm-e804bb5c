
-- 1) dashboard_widgets: catálogo
CREATE TABLE public.dashboard_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  surface TEXT NOT NULL CHECK (surface IN ('dashboard','mi_dia','both')),
  kind TEXT NOT NULL CHECK (kind IN ('native','custom_metric')),
  native_key TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_role TEXT NOT NULL DEFAULT 'user' CHECK (min_role IN ('user','admin','owner')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  default_position INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
CREATE INDEX idx_dashboard_widgets_tenant_surface ON public.dashboard_widgets (tenant_id, surface, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_widgets TO authenticated;
GRANT ALL ON public.dashboard_widgets TO service_role;

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer nativas globales (tenant_id null) y las del propio tenant
CREATE POLICY "widgets_select" ON public.dashboard_widgets FOR SELECT TO authenticated
USING (
  tenant_id IS NULL
  OR tenant_id = public.get_user_tenant(auth.uid())
);

-- Solo admins/owners del tenant crean/editan/eliminan widgets del propio tenant
CREATE POLICY "widgets_insert" ON public.dashboard_widgets FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner') OR public.has_role(auth.uid(),'org_owner'))
);

CREATE POLICY "widgets_update" ON public.dashboard_widgets FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner') OR public.has_role(auth.uid(),'org_owner'))
);

CREATE POLICY "widgets_delete" ON public.dashboard_widgets FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (public.has_role(auth.uid(),'tenant_admin') OR public.has_role(auth.uid(),'tenant_owner') OR public.has_role(auth.uid(),'org_owner'))
);

CREATE TRIGGER trg_dashboard_widgets_updated
BEFORE UPDATE ON public.dashboard_widgets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) dashboard_layouts: layout por scope
CREATE TABLE public.dashboard_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('dashboard','mi_dia')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, scope, surface)
);
CREATE INDEX idx_dashboard_layouts_lookup ON public.dashboard_layouts (tenant_id, surface, scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Los usuarios del tenant leen todos los layouts del tenant (para resolver cascada)
CREATE POLICY "layouts_select" ON public.dashboard_layouts FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()));

-- Cada usuario escribe su propio scope; admins escriben cualquiera
CREATE POLICY "layouts_insert" ON public.dashboard_layouts FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    scope = 'user:' || auth.uid()::text
    OR public.has_role(auth.uid(),'tenant_admin')
    OR public.has_role(auth.uid(),'tenant_owner')
    OR public.has_role(auth.uid(),'org_owner')
  )
);

CREATE POLICY "layouts_update" ON public.dashboard_layouts FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    scope = 'user:' || auth.uid()::text
    OR public.has_role(auth.uid(),'tenant_admin')
    OR public.has_role(auth.uid(),'tenant_owner')
    OR public.has_role(auth.uid(),'org_owner')
  )
);

CREATE POLICY "layouts_delete" ON public.dashboard_layouts FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (
    scope = 'user:' || auth.uid()::text
    OR public.has_role(auth.uid(),'tenant_admin')
    OR public.has_role(auth.uid(),'tenant_owner')
    OR public.has_role(auth.uid(),'org_owner')
  )
);

CREATE TRIGGER trg_dashboard_layouts_updated
BEFORE UPDATE ON public.dashboard_layouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Seed del catálogo nativo global (tenant_id NULL = visible para todos los tenants)
INSERT INTO public.dashboard_widgets (tenant_id, key, name, description, surface, kind, native_key, min_role, is_active, is_mandatory, default_position) VALUES
  -- Dashboard
  (NULL, 'dash.morning_briefing', 'Briefing matutino', 'Resumen automático del día generado por IA.', 'dashboard', 'native', 'morning_briefing', 'user', true, false, 5),
  (NULL, 'dash.risk_alert',       'Alerta de riesgos', 'Deals sin actividad reciente.', 'dashboard', 'native', 'risk_alert', 'user', true, false, 10),
  (NULL, 'dash.header',           'Encabezado y saludo', 'Nombre, fecha y botón "Resumen del día".', 'dashboard', 'native', 'header', 'user', true, true, 15),
  (NULL, 'dash.run_rate',         'Run Rate del mes', 'Ritmo de ventas vs meta mensual.', 'dashboard', 'native', 'run_rate', 'user', true, false, 20),
  (NULL, 'dash.profitability',    'Rentabilidad del mes', 'Margen entre ventas y gastos.', 'dashboard', 'native', 'profitability', 'user', true, false, 25),
  (NULL, 'dash.kpi_cards',        'Tarjetas KPI', 'Pipeline, oportunidades, mensajes y tasa de cierre.', 'dashboard', 'native', 'kpi_cards', 'user', true, false, 30),
  (NULL, 'dash.ai_section',       'Inteligencia del negocio', 'Widgets IA: salud, oportunidades, riesgos y resumen ejecutivo.', 'dashboard', 'native', 'ai_section', 'user', true, false, 35),
  (NULL, 'dash.task_cards',       'Tareas vencidas y próximas', 'Panel de tareas del equipo.', 'dashboard', 'native', 'task_cards', 'user', true, false, 40),
  (NULL, 'dash.activity',         'Actividad reciente', 'Últimas acciones del equipo.', 'dashboard', 'native', 'activity', 'user', true, false, 45),
  (NULL, 'dash.proactive_briefing','Sugerencias proactivas', 'Briefing proactivo de la IA.', 'dashboard', 'native', 'proactive_briefing', 'user', true, false, 50),
  (NULL, 'dash.pipeline_chart',   'Pipeline por etapa', 'Gráfica de valor por etapa.', 'dashboard', 'native', 'pipeline_chart', 'user', true, false, 55),
  (NULL, 'dash.deals_closed',     'Oportunidades cerradas', 'Timeline de deals ganados (30 días).', 'dashboard', 'native', 'deals_closed', 'user', true, false, 60),

  -- Mi Día
  (NULL, 'midia.kpi_row',         'Fila de KPIs', 'Run Rate, Rentabilidad, Ventas, Tareas, Cobrar, Cotizar.', 'mi_dia', 'native', 'kpi_row', 'user', true, true, 10),
  (NULL, 'midia.detail_expanded', 'Detalle del KPI seleccionado', 'Panel que se abre al hacer click en un KPI.', 'mi_dia', 'native', 'detail_expanded', 'user', true, true, 15),
  (NULL, 'midia.collect',         'Cobrar hoy', 'Deals con pago pendiente que vencen hoy.', 'mi_dia', 'native', 'collect', 'user', true, false, 20),
  (NULL, 'midia.quote',           'Cotizar', 'Oportunidades esperando cotización.', 'mi_dia', 'native', 'quote', 'user', true, false, 25),
  (NULL, 'midia.services',        'Servicios de hoy', 'Mantenimientos e instalaciones agendadas.', 'mi_dia', 'native', 'services', 'user', true, false, 30),
  (NULL, 'midia.followup',        'Seguimiento', 'Clientes en negociación.', 'mi_dia', 'native', 'followup', 'user', true, false, 35),
  (NULL, 'midia.tasks',           'Mis tareas de hoy', 'Pendientes del día.', 'mi_dia', 'native', 'tasks', 'user', true, false, 40)
ON CONFLICT DO NOTHING;
