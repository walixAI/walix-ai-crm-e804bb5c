CREATE TABLE public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.get_user_tenant(auth.uid()),
  name text NOT NULL,
  advisor_can_attach boolean NOT NULL DEFAULT false,
  agent_can_send boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.get_user_tenant(auth.uid()),
  category_id uuid NOT NULL REFERENCES public.document_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_mime_ok CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv')),
  CONSTRAINT documents_size_ok CHECK (size_bytes <= 20971520)
);
CREATE INDEX ON public.documents(tenant_id, category_id);
CREATE INDEX ON public.document_categories(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.document_categories TO service_role;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_documents(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _tenant_id = public.get_user_tenant(_user_id) AND NOT public.is_rep_only(_user_id, _tenant_id)
$$;
CREATE OR REPLACE FUNCTION public.can_read_document_category(_user_id uuid, _category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.document_categories c
    WHERE c.id = _category_id AND c.tenant_id = public.get_user_tenant(_user_id)
      AND (c.advisor_can_attach OR NOT public.is_rep_only(_user_id, c.tenant_id)))
$$;

CREATE POLICY "doc_cat_select" ON public.document_categories FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND (advisor_can_attach OR public.can_manage_documents(auth.uid(), tenant_id)));
CREATE POLICY "doc_cat_insert" ON public.document_categories FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_documents(auth.uid(), tenant_id));
CREATE POLICY "doc_cat_update" ON public.document_categories FOR UPDATE TO authenticated
  USING (public.can_manage_documents(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_documents(auth.uid(), tenant_id));
CREATE POLICY "doc_cat_delete" ON public.document_categories FOR DELETE TO authenticated
  USING (public.can_manage_documents(auth.uid(), tenant_id));

CREATE POLICY "docs_select" ON public.documents FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.can_read_document_category(auth.uid(), category_id));
CREATE POLICY "docs_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_documents(auth.uid(), tenant_id)
    AND EXISTS (SELECT 1 FROM public.document_categories c WHERE c.id = category_id AND c.tenant_id = documents.tenant_id));
CREATE POLICY "docs_update" ON public.documents FOR UPDATE TO authenticated
  USING (public.can_manage_documents(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_documents(auth.uid(), tenant_id)
    AND EXISTS (SELECT 1 FROM public.document_categories c WHERE c.id = category_id AND c.tenant_id = documents.tenant_id));
CREATE POLICY "docs_delete" ON public.documents FOR DELETE TO authenticated
  USING (public.can_manage_documents(auth.uid(), tenant_id));

CREATE TRIGGER document_categories_updated BEFORE UPDATE ON public.document_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage: path = {tenant_id}/{category_id}/{file}
CREATE POLICY "tenant_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tenant-documents'
    AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
    AND public.can_read_document_category(auth.uid(), ((storage.foldername(name))[2])::uuid));
CREATE POLICY "tenant_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-documents'
    AND public.can_manage_documents(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "tenant_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-documents' AND public.can_manage_documents(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "tenant_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-documents' AND public.can_manage_documents(auth.uid(), ((storage.foldername(name))[1])::uuid));