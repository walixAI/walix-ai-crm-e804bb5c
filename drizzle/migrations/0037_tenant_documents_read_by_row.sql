DROP POLICY IF EXISTS "tenant_docs_read" ON storage.objects;
CREATE POLICY "tenant_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tenant-documents'
    AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
    AND (public.can_manage_documents(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR EXISTS (SELECT 1 FROM public.documents d WHERE d.storage_path = storage.objects.name
        AND public.can_read_document_category(auth.uid(), d.category_id))));