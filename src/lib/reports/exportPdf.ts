import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import {
  funnelStages, sellerPerformance, sellers, leadSources,
  lostReasons, stageConversions, lostTotalAmount,
} from "@/mock/reports";

export interface PdfExportOptions {
  periodLabel: string;
  sellersLabel: string;
  generatedBy: string;
  /** DOM nodes (refs.current) to capture as images. Order matters. */
  charts: { title: string; node: HTMLElement | null }[];
  /** Optional executive summary plain-text (citations stripped). */
  executiveSummary?: string;
}

const PRIMARY = "#4F46E5";
const TEXT = "#0F172A";
const MUTED = "#64748B";

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text("Walix.ai · Reportes", 14, h - 8);
    doc.text(`Página ${i} de ${pageCount}`, w - 14, h - 8, { align: "right" });
  }
}

function addCover(doc: jsPDF, opts: PdfExportOptions) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Brand bar
  doc.setFillColor(PRIMARY);
  doc.rect(0, 0, w, 70, "F");

  // Title
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Reportes & Analytics", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("Walix.ai · CRM con WhatsApp e IA", 14, 50);

  // Meta block
  doc.setTextColor(TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumen del período", 14, 90);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  const meta: [string, string][] = [
    ["Período", opts.periodLabel],
    ["Vendedores", opts.sellersLabel],
    ["Generado por", opts.generatedBy],
    ["Fecha", new Date().toLocaleString("es-MX")],
  ];
  let y = 100;
  meta.forEach(([k, v]) => {
    doc.setTextColor(MUTED);
    doc.text(k, 14, y);
    doc.setTextColor(TEXT);
    doc.text(v, 60, y);
    y += 8;
  });

  // Executive summary
  if (opts.executiveSummary) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(TEXT);
    doc.text("Resumen ejecutivo IA", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    const lines = doc.splitTextToSize(opts.executiveSummary, w - 28);
    doc.text(lines, 14, y + 4);
  }

  // Footer note on cover
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("Documento confidencial — uso interno", 14, h - 14);
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(PRIMARY);
  doc.rect(14, y - 4, 4, 10, "F");
  doc.setTextColor(TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(text, 22, y + 4);
  doc.setDrawColor("#E2E8F0");
  doc.line(14, y + 10, w - 14, y + 10);
  return y + 18;
}

async function captureNode(node: HTMLElement): Promise<string | null> {
  try {
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("[exportPdf] capture failed:", err);
    return null;
  }
}

export async function exportReportsPdf(opts: PdfExportOptions): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Cover
  addCover(doc, opts);

  // ── Funnel chart (captured)
  doc.addPage();
  let y = sectionTitle(doc, "1. Embudo de ventas", 20);
  const funnelChart = opts.charts.find(c => c.title === "funnel")?.node;
  if (funnelChart) {
    const img = await captureNode(funnelChart);
    if (img) {
      const imgW = w - 28;
      const imgH = (funnelChart.offsetHeight / funnelChart.offsetWidth) * imgW;
      doc.addImage(img, "PNG", 14, y, imgW, Math.min(imgH, 100));
      y += Math.min(imgH, 100) + 6;
    }
  }
  autoTable(doc, {
    startY: y,
    head: [["Etapa", "Deals", "Valor", "Conv. desde anterior"]],
    body: funnelStages.map(s => [
      s.name,
      String(s.count),
      fmtMXN(s.value),
      s.conversionFromPrev != null ? `${s.conversionFromPrev}%` : "—",
    ]),
    headStyles: { fillColor: PRIMARY, textColor: "#FFFFFF" },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // ── Seller performance
  doc.addPage();
  y = sectionTitle(doc, "2. Rendimiento por vendedor", 20);
  const sellerName = (id: string) => sellers.find(s => s.id === id)?.name ?? id;
  autoTable(doc, {
    startY: y,
    head: [["Vendedor", "Leads", "Activos", "Cerrados", "Revenue", "Días cierre", "Tasa %"]],
    body: sellerPerformance.map(p => [
      sellerName(p.sellerId),
      String(p.leadsAssigned),
      String(p.activeDeals),
      String(p.closedDeals),
      fmtMXN(p.revenueGenerated),
      String(p.avgCloseDays),
      `${p.closeRate}%`,
    ]),
    headStyles: { fillColor: PRIMARY, textColor: "#FFFFFF" },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // ── Lead sources (chart + table)
  doc.addPage();
  y = sectionTitle(doc, "3. Fuentes de leads", 20);
  const pieChart = opts.charts.find(c => c.title === "pie")?.node;
  if (pieChart) {
    const img = await captureNode(pieChart);
    if (img) {
      const imgW = (w - 28) * 0.55;
      const imgH = (pieChart.offsetHeight / pieChart.offsetWidth) * imgW;
      doc.addImage(img, "PNG", 14, y, imgW, Math.min(imgH, 80));
    }
  }
  autoTable(doc, {
    startY: y + 90,
    head: [["Fuente", "Leads", "Revenue"]],
    body: leadSources.map(l => [l.name, String(l.count), fmtMXN(l.revenue)]),
    headStyles: { fillColor: PRIMARY, textColor: "#FFFFFF" },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // ── Lost deals
  doc.addPage();
  y = sectionTitle(doc, "4. Razones de pérdida", 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(`Total perdido: ${fmtMXN(lostTotalAmount)}`, 14, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Razón", "Deals", "Monto"]],
    body: lostReasons.map(r => [r.reason, String(r.count), fmtMXN(r.amount)]),
    headStyles: { fillColor: PRIMARY, textColor: "#FFFFFF" },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // ── Heatmap (captured)
  const heatmapNode = opts.charts.find(c => c.title === "heatmap")?.node;
  if (heatmapNode) {
    doc.addPage();
    y = sectionTitle(doc, "5. Actividad del equipo", 20);
    const img = await captureNode(heatmapNode);
    if (img) {
      const imgW = w - 28;
      const imgH = (heatmapNode.offsetHeight / heatmapNode.offsetWidth) * imgW;
      doc.addImage(img, "PNG", 14, y, imgW, Math.min(imgH, pageH - y - 20));
    }
  }

  // ── Stage conversions
  doc.addPage();
  y = sectionTitle(doc, "6. Conversiones por etapa", 20);
  autoTable(doc, {
    startY: y,
    head: [["Origen", "Destino", "Avanzaron", "% Conversión"]],
    body: stageConversions.map(c => [c.from, c.to, String(c.advanced), `${c.rate}%`]),
    headStyles: { fillColor: PRIMARY, textColor: "#FFFFFF" },
    styles: { fontSize: 9 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const rate = stageConversions[data.row.index].rate;
        if (rate < 30) {
          data.cell.styles.textColor = "#DC2626";
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`walix-reporte-${stamp}.pdf`);
}