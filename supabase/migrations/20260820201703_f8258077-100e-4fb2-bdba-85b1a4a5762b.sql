insert into public.dashboard_widgets (tenant_id, key, name, description, surface, kind, native_key, min_role, is_active, is_mandatory, default_position) values
  (NULL, 'dash.profitability', 'Rentabilidad del mes', 'Ventas, gastos, utilidad y margen del mes.', 'dashboard', 'native', 'profitability', 'user', true, false, 21),
  (NULL, 'midia.profitability', 'Rentabilidad (Mi Día)', 'Indicador de rentabilidad y su detalle en Mi Día.', 'mi_dia', 'native', 'profitability', 'user', true, false, 15)
on conflict do nothing;