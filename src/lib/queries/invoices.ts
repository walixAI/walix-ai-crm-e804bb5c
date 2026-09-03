import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantInvoice {
  id: string;
  tenantId: string;
  period: string; // YYYY-MM-DD (día 1)
  folio: string | null;
  uuidFiscal: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number;
  currency: string;
  status: string;
  pdfPath: string | null;
  xmlPath: string | null;
  issuerName: string | null;
  issuerRfc: string | null;
  receiverName: string | null;
  receiverRfc: string | null;
  concept: string | null;
}

export function useTenantInvoices(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-invoices", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantInvoice[]> => {
      const { data, error } = await supabase
        .from("tenant_invoices")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("period", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        period: r.period,
        folio: r.folio,
        uuidFiscal: r.uuid_fiscal,
        subtotal: r.subtotal !== null ? Number(r.subtotal) : null,
        tax: r.tax !== null ? Number(r.tax) : null,
        total: Number(r.total ?? 0),
        currency: r.currency ?? "MXN",
        status: r.status ?? "paid",
        pdfPath: r.pdf_path,
        xmlPath: r.xml_path,
        issuerName: r.issuer_name,
        issuerRfc: r.issuer_rfc,
        receiverName: r.receiver_name,
        receiverRfc: r.receiver_rfc,
        concept: r.concept,
      }));
    },
  });
}

/** Consumo del periodo para el recibo de compra. */
export interface PeriodUsage {
  aiRequests: number;
  aiTokens: number;
  waConversations: number;
  waCredits: number;
}

export async function fetchPeriodUsage(tenantId: string, period: string): Promise<PeriodUsage> {
  const start = new Date(`${period.slice(0, 7)}-01T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const range = [start.toISOString(), end.toISOString()] as const;

  const [ai, wa] = await Promise.all([
    supabase
      .from("ai_usage_log")
      .select("total_tokens")
      .eq("tenant_id", tenantId)
      .gte("created_at", range[0])
      .lt("created_at", range[1]),
    supabase
      .from("whatsapp_conversation_billing")
      .select("credits_charged")
      .eq("tenant_id", tenantId)
      .gte("created_at", range[0])
      .lt("created_at", range[1]),
  ]);

  const aiRows = (ai.data ?? []) as any[];
  const waRows = (wa.data ?? []) as any[];
  return {
    aiRequests: aiRows.length,
    aiTokens: aiRows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0),
    waConversations: waRows.length,
    waCredits: waRows.reduce((s, r) => s + Number(r.credits_charged ?? 0), 0),
  };
}

/** Pide al backend un enlace firmado y dispara la descarga del CFDI. */
export async function downloadCfdi(invoiceId: string, kind: "pdf" | "xml") {
  const { data, error } = await supabase.functions.invoke("invoice-download", {
    body: { invoice_id: invoiceId, kind },
  });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error ?? "No se pudo obtener el archivo");
  window.open(data.url as string, "_blank");
}
