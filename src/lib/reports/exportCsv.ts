import {
  funnelStages, sellerPerformance, sellers, leadSources,
  lostReasons, stageConversions,
} from "@/mock/reports";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(values: (string | number)[]): string {
  return values.map(csvEscape).join(",");
}

function section(title: string, header: string[], rows: (string | number)[][]): string {
  return [
    `# ${title}`,
    row(header),
    ...rows.map(row),
    "",
  ].join("\n");
}

export function buildReportsCSV(periodLabel: string): string {
  const header = [
    `# Walix · Reporte ${periodLabel}`,
    `# Generado: ${new Date().toLocaleString("es-MX")}`,
    "",
  ].join("\n");

  const sellerName = (id: string) =>
    sellers.find(s => s.id === id)?.name ?? id;

  return [
    header,
    section(
      "Embudo de ventas",
      ["Etapa", "Deals", "Valor MXN", "Conversión %"],
      funnelStages.map(s => [s.name, s.count, s.value, s.conversionFromPrev ?? ""]),
    ),
    section(
      "Rendimiento por vendedor",
      ["Vendedor", "Leads", "Activos", "Cerrados", "Revenue MXN", "Días promedio cierre", "Tasa cierre %"],
      sellerPerformance.map(p => [
        sellerName(p.sellerId), p.leadsAssigned, p.activeDeals,
        p.closedDeals, p.revenueGenerated, p.avgCloseDays, p.closeRate,
      ]),
    ),
    section(
      "Fuentes de leads",
      ["Fuente", "Leads", "Revenue MXN"],
      leadSources.map(l => [l.name, l.count, l.revenue]),
    ),
    section(
      "Razones de pérdida",
      ["Razón", "Deals", "Monto MXN"],
      lostReasons.map(r => [r.reason, r.count, r.amount]),
    ),
    section(
      "Conversiones por etapa",
      ["Origen", "Destino", "Avanzaron", "% Conversión"],
      stageConversions.map(c => [c.from, c.to, c.advanced, c.rate]),
    ),
  ].join("\n");
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}