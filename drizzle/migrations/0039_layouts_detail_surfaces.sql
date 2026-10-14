ALTER TABLE public.dashboard_widgets DROP CONSTRAINT IF EXISTS dashboard_widgets_surface_check;
ALTER TABLE public.dashboard_widgets ADD CONSTRAINT dashboard_widgets_surface_check CHECK (surface = ANY (ARRAY['dashboard','mi_dia','both','contact_detail','deal_detail']));
ALTER TABLE public.dashboard_layouts DROP CONSTRAINT IF EXISTS dashboard_layouts_surface_check;
ALTER TABLE public.dashboard_layouts ADD CONSTRAINT dashboard_layouts_surface_check CHECK (surface = ANY (ARRAY['dashboard','mi_dia','contact_detail','deal_detail']));