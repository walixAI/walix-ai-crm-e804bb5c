-- Restringir lectura del bucket tenant-assets: solo miembros del tenant
DROP POLICY IF EXISTS "public reads logos" ON storage.objects;

CREATE POLICY "tenant members read logos" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id='tenant-assets'
    AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
  );

-- Hacer bucket privado (los logos se servirán mediante signed URLs o por miembros autenticados)
UPDATE storage.buckets SET public = false WHERE id = 'tenant-assets';