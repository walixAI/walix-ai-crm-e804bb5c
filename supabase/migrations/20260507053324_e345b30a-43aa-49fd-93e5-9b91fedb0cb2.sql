
-- Update existing aprendiz agents to allow the new tool
UPDATE public.ai_agents
SET allowed_tools = ARRAY['update_tenant_pattern','update_user_profile_insights']::text[]
WHERE agent_type = 'aprendiz';

-- Update seeder
CREATE OR REPLACE FUNCTION public.seed_default_ai_agents(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_agents (tenant_id, name, description, agent_type, system_prompt, schedule, model, allowed_tools, max_actions_per_run, next_run_at) VALUES
  (_tenant_id, 'Guardián de Seguimientos',
    'Revisa cada mañana los deals activos y alerta sobre los que llevan más de 5 días sin actividad.',
    'followup_watchdog',
    'Eres el Guardián de Seguimientos de Walix. Tu objetivo: revisar deals activos sin actividad reciente y crear sugerencias proactivas concisas para el vendedor asignado. Sé directo. Una sugerencia por deal. No envíes WhatsApp.',
    '0 9 * * 1-5', 'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','get_contact_context','create_task','create_proactive_suggestion'],
    20, now()),
  (_tenant_id, 'Detector de Riesgo',
    'Cada tarde detecta deals en Propuesta/Negociación que muestren señales de enfriamiento.',
    'deal_risk_detector',
    'Eres el Detector de Riesgo. Analiza deals avanzados con señales de enfriamiento y crea sugerencias de prioridad alta para el gerente.',
    '0 18 * * 1-5', 'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','get_contact_context','create_proactive_suggestion'],
    10, now()),
  (_tenant_id, 'Briefing Matutino',
    'Genera el briefing personalizado del día para cada vendedor activo.',
    'morning_briefing',
    'Eres el Briefing Matutino. Para el usuario indicado, genera 3 sugerencias top con priority=10. Texto breve y accionable.',
    '30 7 * * 1-5', 'google/gemini-2.5-flash',
    ARRAY['get_pipeline_status','search_contacts','get_contact_context','create_proactive_suggestion'],
    30, now()),
  (_tenant_id, 'Coach Semanal',
    'Cada lunes analiza el rendimiento de la semana anterior y entrega coaching personalizado.',
    'weekly_coach',
    'Eres el Coach Semanal de ventas. Analiza datos de la semana anterior por vendedor y entrega 1-2 recomendaciones concretas.',
    '0 8 * * 1', 'google/gemini-2.5-pro',
    ARRAY['get_pipeline_status','search_contacts','create_proactive_suggestion'],
    15, now()),
  (_tenant_id, 'Aprendiz',
    'Cada domingo analiza los resultados de la última semana y aprende patrones específicos de tu negocio y de cada vendedor.',
    'aprendiz',
    'Eres el Aprendiz de Walix. Recibes agregados de outcomes reales de la última semana. Tu trabajo: detectar patrones del negocio (mejor día de seguimiento, horas pico, objeciones, tiempo de cierre) llamando update_tenant_pattern, y completar el perfil individual de cada vendedor con fortalezas y áreas de mejora cualitativas llamando update_user_profile_insights. Asigna confidence_score entre 0 y 1 según el tamaño de muestra (≥50: alta, ≥20: media, <20: baja).',
    '0 3 * * 0', 'google/gemini-2.5-flash',
    ARRAY['update_tenant_pattern','update_user_profile_insights'],
    10, now())
  ON CONFLICT DO NOTHING;
END;
$$;
