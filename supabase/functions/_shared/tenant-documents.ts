// Documentos del tenant compartidos por asesores (whatsapp-send) y Agente de Ventas.
import { documentFilename, shortDocumentTitle } from "./document-name.ts";
export const DOCS_BUCKET = "tenant-documents";

export type TenantDoc = { id: string; name: string; description: string | null; storage_path: string; mime_type: string };

/** Documentos de categorías habilitadas para el Agente de Ventas. */
export async function loadAgentDocuments(sb: any, tenantId: string): Promise<TenantDoc[]> {
  const { data } = await sb.from("documents")
    .select("id, name, description, storage_path, mime_type, document_categories!inner(agent_can_send)")
    .eq("tenant_id", tenantId).eq("document_categories.agent_can_send", true).limit(40);
  return (data ?? []).map((doc: TenantDoc) => ({ ...doc, name: shortDocumentTitle(doc.name) })) as TenantDoc[];
}

export function documentsPrompt(docs: TenantDoc[]): string {
  if (!docs.length) return "";
  return "\n\n## DOCUMENTOS QUE PUEDES ENVIAR\nSolo si el lead lo pide o realmente le ayuda (temario, folleto, plan de estudios, lista de precios), indica su id en \"document_id\". Máximo uno por respuesta; nunca menciones documentos que no estén aquí.\n" +
    docs.map((d) => `- id=${d.id} · ${d.name}${d.description ? ` — ${d.description}` : ""}`).join("\n");
}

export async function signedDocumentUrl(service: any, path: string, seconds = 3600): Promise<string | null> {
  const { data, error } = await service.storage.from(DOCS_BUCKET).createSignedUrl(path, seconds);
  if (error) { console.error("signed url", error); return null; }
  return data?.signedUrl ?? null;
}

export function isImage(mime: string) { return mime === "image/jpeg" || mime === "image/png"; }

/** Payload de Meta para enviar un documento o imagen por enlace. */
export function waMediaPayload(to: string, doc: TenantDoc, link: string, caption?: string) {
  const filename = documentFilename(doc.name, doc.storage_path);
  return isImage(doc.mime_type)
    ? { messaging_product: "whatsapp", to, type: "image", image: { link, ...(caption ? { caption } : {}) } }
    : { messaging_product: "whatsapp", to, type: "document", document: { link, filename, ...(caption ? { caption } : {}) } };
}

export function docMessageBody(doc: TenantDoc, caption?: string) {
  return `📎 Documento enviado: ${shortDocumentTitle(doc.name)}${caption ? `\n${caption}` : ""}`;
}
