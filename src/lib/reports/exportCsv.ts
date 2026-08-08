import type { ReportsData } from "@/lib/queries/reports";
import type { TenantUser } from "@/lib/queries/tenantUsers";

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

export function buildReportsCSV(
  periodLabel: string,
  data: ReportsData,
  users: TenantUser[],
  tenantName?: string | null,
): string {
  const header = [
    ...(tenantName ? [`# ${tenantName}`] : []),
    `# Reporte ${periodLabel} · generado con Walix`,
    `# Generado: ${new Date().toLocaleString("es-MX")}`,
    "",
  ].join("\n");

  const userName = (id: string) => users.find(u => u.id === id)?.name ?? id;

  return [
    header,
    section(
      "Embudo de ventas",
      ["Etapa", "Deals", "Valor MXN", "Conversión %"],
      data.funnel.map(s => [s.name, s.count, s.value, s.conversionFromPrev ?? ""]),
    ),
    section(
      "Rendimiento por vendedor",
      ["Vendedor", "Leads", "Activos", "Cerrados", "Revenue MXN", "Días promedio cierre", "Tasa cierre %"],
      data.sellerPerformance.map(p => [
        userName(p.sellerId), p.leadsAssigned, p.activeDeals,
        p.closedDeals, p.revenueGenerated, p.avgCloseDays, p.closeRate,
      ]),
    ),
    section(
      "Fuentes de leads",
      ["Fuente", "Leads", "Revenue MXN"],
      data.leadSources.map(l => [l.name, l.count, l.revenue]),
    ),
    section(
      "Razones de pérdida",
      ["Razón", "Deals", "Monto MXN"],
      data.lostReasons.map(r => [r.reason, r.count, r.amount]),
    ),
    section(
      "Conversiones por etapa",
      ["Origen", "Destino", "Avanzaron", "% Conversión"],
      data.stageConversions.map(c => [c.from, c.to, c.advanced, c.rate]),
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
