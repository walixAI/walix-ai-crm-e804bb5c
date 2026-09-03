import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMXN } from "@/lib/plans";
import type { PeriodUsage, TenantInvoice } from "@/lib/queries/invoices";

const BRAND: [number, number, number] = [79, 70, 229];

function monthLabel(period: string) {
  const d = new Date(`${period.slice(0, 7)}-01T00:00:00`);
  const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ReceiptInput {
  invoice: TenantInvoice;
  tenantName: string;
  planLabel: string;
  usage: PeriodUsage;
  includedAiCredits?: number;
  includedWaCredits?: number;
}

/** Construye el documento del "Recibo de compra" del mes con el detalle del periodo. */
export function buildReceiptDoc({
  invoice,
  tenantName,
  planLabel,
  usage,
  includedAiCredits,
  includedWaCredits,
}: ReceiptInput) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const period = monthLabel(invoice.period);

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 76, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Walix", 40, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Recibo de compra", 40, 56);
  doc.setFontSize(10);
  doc.text(period, W - 40, 56, { align: "right" });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  let y = 108;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 200, y);
    y += 16;
  };
  line("Cliente:", tenantName);
  if (invoice.receiverName) line("Razón social:", invoice.receiverName);
  if (invoice.receiverRfc) line("RFC receptor:", invoice.receiverRfc);
  line("Periodo facturado:", period);
  line("Plan contratado:", planLabel);
  if (invoice.folio) line("Folio:", invoice.folio);
  if (invoice.uuidFiscal) line("UUID fiscal:", invoice.uuidFiscal);
  line("Estatus:", invoice.status === "paid" ? "Pagado" : invoice.status);

  autoTable(doc, {
    startY: y + 10,
    head: [["Concepto", "Cant.", "Importe"]],
    body: [
      [
        invoice.concept ?? `Suscripción mensual Walix (${period})`,
        "1",
        formatMXN(invoice.subtotal ?? invoice.total),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: { 1: { halign: "center", cellWidth: 50 }, 2: { halign: "right", cellWidth: 100 } },
    margin: { left: 40, right: 40 },
  });

  let afterY = (doc as any).lastAutoTable.finalY + 12;
  const totals: [string, string][] = [
    ["Subtotal", formatMXN(invoice.subtotal ?? invoice.total)],
    ["IVA 16%", formatMXN(invoice.tax ?? 0)],
    ["Total", `${formatMXN(invoice.total)} ${invoice.currency}`],
  ];
  totals.forEach(([k, v], i) => {
    doc.setFont("helvetica", i === totals.length - 1 ? "bold" : "normal");
    doc.setFontSize(i === totals.length - 1 ? 11 : 10);
    doc.text(k, W - 220, afterY);
    doc.text(v, W - 40, afterY, { align: "right" });
    afterY += 16;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Detalle de consumo del mes", 40, afterY + 22);

  autoTable(doc, {
    startY: afterY + 32,
    head: [["Recurso", "Incluido en el plan", "Consumido"]],
    body: [
      [
        "Créditos de IA",
        includedAiCredits ? includedAiCredits.toLocaleString("es-MX") : "—",
        `${usage.aiRequests.toLocaleString("es-MX")} solicitudes · ${usage.aiTokens.toLocaleString("es-MX")} tokens`,
      ],
      [
        "Conversaciones WhatsApp",
        includedWaCredits ? includedWaCredits.toLocaleString("es-MX") : "—",
        `${usage.waConversations.toLocaleString("es-MX")} conversaciones · ${usage.waCredits.toLocaleString("es-MX")} créditos`,
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: BRAND, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 6 },
    margin: { left: 40, right: 40 },
  });

  const endY = (doc as any).lastAutoTable.finalY + 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Este recibo es un comprobante informativo de tu suscripción. El comprobante fiscal es el CFDI (PDF y XML).",
    40,
    endY,
    { maxWidth: W - 80 },
  );
  doc.text(
    `Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`,
    40,
    endY + 14,
  );

  return doc;
}

/** Genera y descarga el recibo de compra del mes. */
export function generateReceiptPdf(input: ReceiptInput) {
  const doc = buildReceiptDoc(input);
  doc.save(`Recibo-Walix-${input.invoice.period.slice(0, 7)}.pdf`);
}
