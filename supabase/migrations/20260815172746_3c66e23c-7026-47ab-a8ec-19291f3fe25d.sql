UPDATE public.deals d
SET owner_id = c.owner_id
FROM public.contacts c
WHERE c.id = d.contact_id
  AND d.owner_id IS NULL
  AND c.owner_id IS NOT NULL;