CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.whatsapp_command_log
  ADD COLUMN IF NOT EXISTS reply text,
  ADD COLUMN IF NOT EXISTS result_entity_type text,
  ADD COLUMN IF NOT EXISTS result_entity_id uuid,
  ADD COLUMN IF NOT EXISTS undone_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_context jsonb;

CREATE INDEX IF NOT EXISTS idx_wa_cmd_log_phone_created
  ON public.whatsapp_command_log (tenant_id, from_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_contacts_fuzzy(
  _tenant_id uuid,
  _q text,
  _owner_id uuid DEFAULT NULL,
  _limit int DEFAULT 5
)
RETURNS TABLE(id uuid, name text, company text, phone text, status text, score real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.company, c.phone, c.status::text,
         GREATEST(
           similarity(lower(c.name), lower(_q)),
           COALESCE(MAX(word_similarity(lower(tok), lower(c.name))), 0)
         )::real AS score
  FROM public.contacts c
  LEFT JOIN LATERAL unnest(string_to_array(regexp_replace(lower(_q), '[^a-z0-9áéíóúñ ]', ' ', 'g'), ' ')) AS tok ON length(tok) >= 3
  WHERE c.tenant_id = _tenant_id
    AND (_owner_id IS NULL OR c.owner_id = _owner_id)
  GROUP BY c.id, c.name, c.company, c.phone, c.status
  HAVING GREATEST(
           similarity(lower(c.name), lower(_q)),
           COALESCE(MAX(word_similarity(lower(tok), lower(c.name))), 0)
         ) > 0.25
  ORDER BY score DESC
  LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.search_contacts_fuzzy(uuid, text, uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.search_contacts_fuzzy(uuid, text, uuid, int) TO service_role;