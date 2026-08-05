INSERT INTO public.pipeline_stages (tenant_id, pipeline_id, name, position, is_won, is_lost)
SELECT tenant_id, id, 'Perdido', 5, false, true
FROM public.pipelines WHERE id = 'e35a0c5d-eed0-4c0b-b243-ac7e9bbaefbe'
AND NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages s
  WHERE s.pipeline_id = 'e35a0c5d-eed0-4c0b-b243-ac7e9bbaefbe' AND s.is_lost
);