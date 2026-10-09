ALTER TABLE public.wa_enrollments ADD COLUMN IF NOT EXISTS enrolled_stage_id uuid;

CREATE OR REPLACE FUNCTION public.contact_last_inbound(_tenant_id uuid, _contact_ids uuid[])
RETURNS TABLE (contact_id uuid, last_inbound timestamptz)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cv.contact_id, MAX(COALESCE(m.sent_at, m.created_at)) AS last_inbound
  FROM conversations cv
  JOIN messages m ON m.conversation_id = cv.id
  WHERE cv.tenant_id = _tenant_id
    AND cv.contact_id = ANY (_contact_ids)
    AND m.direction = 'inbound'
  GROUP BY cv.contact_id;
$$;

GRANT EXECUTE ON FUNCTION public.contact_last_inbound(uuid, uuid[]) TO authenticated, service_role;