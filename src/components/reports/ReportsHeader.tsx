import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeriodPicker } from "@/components/reports/PeriodPicker";
import { SellerMultiSelect } from "@/components/reports/SellerMultiSelect";
import { type ReportFilters, periodLabel } from "@/lib/reports/filters";
import { useReportsContext } from "@/lib/reports/context";
import { downloadCSV, buildReportsCSV } from "@/lib/reports/exportCsv";
import { exportReportsPdf } from "@/lib/reports/exportPdf";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/lib/queries/tenant";

interface Props {
  filters: ReportFilters;
  onPeriod: (p: ReportFilters["period"]) => void;
  onSellers: (s: string[]) => void;
  chartRefs: { funnel: HTMLDivElement | null; pie: HTMLDivElement | null; heatmap: HTMLDivElement | null };
  executiveSummary?: string;
  generatedBy: string;
}

export function ReportsHeader({ filters, onPeriod, onSellers, chartRefs, executiveSummary, generatedBy }: Props) {
  const { toast } = useToast();
  const { data, users } = useReportsContext();
  const { data: tenant } = useTenant();
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

  const sellersLabel = filters.sellers.length === 0
    ? "Todos los vendedores"
    : filters.sellers.map(id => users.find(s => s.id === id)?.name ?? id).join(", ");

  const handleCsv = () => {
    if (!data) {
      toast({ title: "Aún cargando", description: "Espera a que terminen de cargar los datos.", variant: "destructive" });
      return;
    }
    setExporting("csv");
    try {
      const csv = buildReportsCSV(
        periodLabel(filters.period),
        data,
        users,
        tenant?.brandName ?? tenant?.name ?? null,
      );
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCSV(`walix-reporte-${stamp}.csv`, csv);
      toast({ title: "CSV exportado", description: "El reporte se descargó correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo generar el CSV.", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const handlePdf = async () => {
    if (!data) {
      toast({ title: "Aún cargando", description: "Espera a que terminen de cargar los datos.", variant: "destructive" });
      return;
    }
    setExporting("pdf");
    try {
      await exportReportsPdf({
        periodLabel: periodLabel(filters.period),
        sellersLabel,
        generatedBy,
        executiveSummary,
        data,
        users,
        tenant: { name: tenant?.brandName ?? tenant?.name, logoUrl: tenant?.logoUrl },
        charts: [
          { title: "funnel",  node: chartRefs.funnel },
          { title: "pie",     node: chartRefs.pie },
          { title: "heatmap", node: chartRefs.heatmap },
        ],
      });
      toast({ title: "PDF exportado", description: "El reporte se descargó correctamente." });
    } catch (err) {
      console.warn(err);
      toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes & Analytics</h1>
          <p className="text-sm text-muted-foreground">Métricas en tiempo real, embudos y exportables</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={filters.period} onChange={onPeriod} />
          <SellerMultiSelect value={filters.sellers} onChange={onSellers} />
          <div className="hidden sm:block h-6 w-px bg-border mx-1" />
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCsv} disabled={exporting !== null}>
            {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={handlePdf} disabled={exporting !== null}>
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>
    </div>
  );
}