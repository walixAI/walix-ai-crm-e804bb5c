
-- Add fields for Mi Día module
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_type text DEFAULT 'venta' CHECK (deal_type IN ('venta','servicio')),
  ADD COLUMN IF NOT EXISTS service_type text CHECK (service_type IN ('mantenimiento','reparacion','instalacion','garantia')),
  ADD COLUMN IF NOT EXISTS equipment_brand text,
  ADD COLUMN IF NOT EXISTS equipment_model text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente','parcial','pagado'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_kind text DEFAULT 'otro' CHECK (task_kind IN ('cobro','cotizacion','servicio','seguimiento','queja','refaccion','facturacion','devolucion','otro'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_prefs jsonb DEFAULT '{"mode":"normal","miDiaColumns":[]}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_deals_type_stage ON public.deals(tenant_id, deal_type, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_scheduled ON public.deals(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tasks_kind_completed ON public.tasks(tenant_id, task_kind, completed);
