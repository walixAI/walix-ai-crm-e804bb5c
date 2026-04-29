import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useReportFilters } from "@/lib/reports/filters";
import { ReportsHeader } from "@/components/reports/ReportsHeader";
import { ExecutiveSummaryAI } from "@/components/reports/ExecutiveSummaryAI";
import { KpiHeroRow } from "@/components/reports/KpiHeroRow";
import { SalesFunnelChart } from "@/components/reports/SalesFunnelChart";
import { SellerPerformanceTable } from "@/components/reports/SellerPerformanceTable";
import { LeadSourcesPie } from "@/components/reports/LeadSourcesPie";
import { LostDealsChart } from "@/components/reports/LostDealsChart";
import { TeamActivityHeatmap } from "@/components/reports/TeamActivityHeatmap";
import { StageConversionsSection } from "@/components/reports/StageConversionsSection";

export default function Reports() {
  const { filters, setPeriod, setSellers } = useReportFilters();
  const { user } = useAuth();
  const [executiveSummary, setExecutiveSummary] = useState<string | undefined>(undefined);
  const [updatedAt] = useState(() => new Date());

  const funnelRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);

  const generatedBy = user?.email ?? user?.user_metadata?.full_name ?? "Walix user";

  return (
    <div className="space-y-6">
      <ReportsHeader
        filters={filters}
        onPeriod={setPeriod}
        onSellers={setSellers}
        chartRefs={{ funnel: funnelRef.current, pie: pieRef.current, heatmap: heatmapRef.current }}
        executiveSummary={executiveSummary}
        generatedBy={generatedBy}
      />

      {/* Resumen ejecutivo IA (reutiliza dashboard-ai-widgets) */}
      <ExecutiveSummaryAI onSummaryReady={setExecutiveSummary} />

      {/* KPI hero */}
      <KpiHeroRow />

      {/* §1 Funnel */}
      <div ref={funnelRef}>
        <SalesFunnelChart />
      </div>

      {/* §2 Sellers */}
      <SellerPerformanceTable />

      {/* §3 + §4 lado a lado en desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div ref={pieRef}>
          <LeadSourcesPie />
        </div>
        <LostDealsChart />
      </div>

      {/* §5 Heatmap */}
      <div ref={heatmapRef}>
        <TeamActivityHeatmap />
      </div>

      {/* §6 Conversions */}
      <StageConversionsSection />

      <div className="text-xs text-muted-foreground text-center pt-2 pb-6">
        Última actualización: {updatedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}