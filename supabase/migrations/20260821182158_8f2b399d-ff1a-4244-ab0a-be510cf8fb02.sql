INSERT INTO public.dashboard_widgets (key, name, description, surface, kind, native_key, min_role, is_active, is_mandatory, default_position)
VALUES ('midia.ai_proposals', 'Propuestas de Walix IA', 'Tareas sugeridas por las automatizaciones que puedes aceptar o rechazar.', 'mi_dia', 'native', 'midia.ai_proposals', 'user', true, false, 12)
ON CONFLICT DO NOTHING;