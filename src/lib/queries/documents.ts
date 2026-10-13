import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { shortDocumentTitle, documentFilename } from "../../../supabase/functions/_shared/document-name";
export { shortDocumentTitle } from "../../../supabase/functions/_shared/document-name";

export const DOCS_BUCKET = "tenant-documents";
export const MAX_DOC_BYTES = 20 * 1024 * 1024;
export const ALLOWED_DOC_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "text/csv": "CSV",
};
export const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv";

export interface DocCategory { id: string; name: string; advisor_can_attach: boolean; agent_can_send: boolean; position: number }
export interface TenantDocument { id: string; category_id: string; name: string; description: string | null; storage_path: string; mime_type: string; size_bytes: number; created_at: string }

/** Infers a valid MIME type (some browsers report Excel/CSV inconsistently). */
export function resolveDocMime(file: File): string | null {
  if (ALLOWED_DOC_TYPES[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv",
  };
  return ext ? byExt[ext] ?? null : null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function useDocCategories() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["doc-categories", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("document_categories").select("id,name,advisor_can_attach,agent_can_send,position")
        .eq("tenant_id", tenantId).order("position").order("name");
      if (error) throw error;
      return (data ?? []) as DocCategory[];
    },
  });
}

export function useDocuments() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["documents", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("documents").select("id,category_id,name,description,storage_path,mime_type,size_bytes,created_at")
        .eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return (data ?? []) as TenantDocument[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["doc-categories"] }); qc.invalidateQueries({ queryKey: ["documents"] }); };
}

export function useSaveCategory() {
  const inv = useInvalidate();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async (c: Partial<DocCategory> & { name?: string }) => {
      if (c.id) {
        const { id, ...patch } = c;
        const { error } = await supabase.from("document_categories").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        if (!tenantId || !c.name?.trim()) throw new Error("Falta la empresa o el nombre de categoría");
        const { error } = await supabase.from("document_categories").insert({ tenant_id: tenantId, name: c.name.trim() });
        if (error) throw error;
      }
    },
    onSuccess: inv,
  });
}

export function useDeleteCategory() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (cat: { id: string; paths: string[] }) => {
      if (cat.paths.length) await supabase.storage.from(DOCS_BUCKET).remove(cat.paths);
      const { error } = await supabase.from("document_categories").delete().eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

export function useUploadDocuments() {
  const inv = useInvalidate();
  const { data: tenantId } = useTenantId();
  return useMutation({
    mutationFn: async ({ categoryId, files }: { categoryId: string; files: File[] }) => {
      if (!tenantId) throw new Error("No se encontró tu empresa");
      for (const f of files) {
        const mime = resolveDocMime(f);
        if (!mime) throw new Error(`${f.name}: solo PDF, JPG, PNG o Excel`);
        if (f.size > MAX_DOC_BYTES) throw new Error(`${f.name}: supera 20 MB`);
        const name = shortDocumentTitle(f.name);
        const safe = documentFilename(name, f.name).replace(/[^\w.\-]+/g, "_");
        const path = `${tenantId}/${categoryId}/${crypto.randomUUID()}-${safe}`;
        const up = await supabase.storage.from(DOCS_BUCKET).upload(path, f, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        const { error } = await supabase.from("documents").insert({
          tenant_id: tenantId, category_id: categoryId, name, storage_path: path, mime_type: mime, size_bytes: f.size,
        });
        if (error) { await supabase.storage.from(DOCS_BUCKET).remove([path]); throw error; }
      }
    },
    onSuccess: inv,
  });
}

export function useUpdateDocument() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; description?: string | null; category_id?: string }) => {
      if (patch.name !== undefined) patch.name = shortDocumentTitle(patch.name);
      const { error } = await supabase.from("documents").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

export function useDeleteDocument() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (d: TenantDocument) => {
      await supabase.storage.from(DOCS_BUCKET).remove([d.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

export async function openDocument(d: Pick<TenantDocument, "storage_path">) {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(d.storage_path, 300);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function downloadDocumentFile(d: Pick<TenantDocument, "storage_path" | "name" | "mime_type">): Promise<File> {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).download(d.storage_path);
  if (error || !data) throw error ?? new Error("No se pudo descargar");
  const name = documentFilename(d.name, d.storage_path);
  return new File([data], name, { type: d.mime_type });
}
