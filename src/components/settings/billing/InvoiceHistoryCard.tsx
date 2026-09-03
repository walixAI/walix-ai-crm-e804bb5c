import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Download, FileCode2, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/plans";
import {
  downloadCfdi,
  fetchPeriodUsage,
  useTenantInvoices,
  type TenantInvoice,
} from "@/lib/queries/invoices";
import { generateReceiptPdf } from "@/lib/billing/receiptPdf";

interface Props {
  tenantId: string;
  tenantName: string;
  planLabel: string;
  fallbackPrice: number;
  includedAiCredits?: number;
  includedWaCredits?: number;
  /** Periodos calculados desde la fecha de inicio de facturación, por si aún no hay CFDI cargado. */
  fallbackInvoices: { id: string; date: string }[];
}

function periodLabel(date: string) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00`);
  const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function InvoiceHistoryCard({
  tenantId,
  tenantName,
  planLabel,
  fallbackPrice,
  includedAiCredits,
  includedWaCredits,
  fallbackInvoices,
}: Props) {
  const { data: invoices = [], isLoading } = useTenantInvoices(tenantId);
  const [busy, setBusy] = useState<string | null>(null);

  const byPeriod = new Map(invoices.map((i) => [i.period.slice(0, 7), i]));

  const rows = fallbackInvoices.map((f) => ({
    key: f.date.slice(0, 7),
    label: f.id,
    date: f.date,
    invoice: byPeriod.get(f.date.slice(0, 7)) ?? null,
  }));
  // Facturas reales que no estén en el rango calculado
  invoices.forEach((inv) => {
    if (!rows.some((r) => r.key === inv.period.slice(0, 7))) {
      rows.push({
        key: inv.period.slice(0, 7),
        label: inv.folio ?? `INV-${inv.period.slice(0, 7)}`,
        date: inv.period,
        invoice: inv,
      });
    }
  });
  rows.sort((a, b) => (a.key < b.key ? 1 : -1));

  const cfdi = async (invoice: TenantInvoice, kind: "pdf" | "xml") => {
    setBusy(`${invoice.id}-${kind}`);
    try {
      await downloadCfdi(invoice.id, kind);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo descargar el CFDI");
    } finally {
      setBusy(null);
    }
  };

  const receipt = async (invoice: TenantInvoice) => {
    setBusy(`${invoice.id}-receipt`);
    try {
      const usage = await fetchPeriodUsage(tenantId, invoice.period);
      generateReceiptPdf({
        invoice,
        tenantName,
        planLabel,
        usage,
        includedAiCredits,
        includedWaCredits,
      });
      toast.success("Recibo de compra generado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo generar el recibo");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        Historial de facturas
      </div>
      <div className="divide-y divide-border">
        {isLoading && (
          <div className="px-5 py-6 text-sm text-muted-foreground text-center">Cargando…</div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="px-5 py-6 text-sm text-muted-foreground text-center">
            Aún no hay facturas emitidas.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-4 px-5 py-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">{periodLabel(r.date)}</div>
            </div>
            <div className="text-sm font-semibold">
              {formatMXN(r.invoice?.total ?? fallbackPrice)}
            </div>
            <WBadge variant="success">
              <Check className="h-3 w-3" /> Pagado
            </WBadge>
            {r.invoice ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!!busy}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar factura
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">
                    {periodLabel(r.date)}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!r.invoice.pdfPath}
                    onSelect={() => cfdi(r.invoice!, "pdf")}
                  >
                    <FileText className="h-4 w-4 mr-2" /> CFDI PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!r.invoice.xmlPath}
                    onSelect={() => cfdi(r.invoice!, "xml")}
                  >
                    <FileCode2 className="h-4 w-4 mr-2" /> CFDI XML
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => receipt(r.invoice!)}>
                    <Receipt className="h-4 w-4 mr-2" /> Recibo de compra
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-xs text-muted-foreground">Sin archivos</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
