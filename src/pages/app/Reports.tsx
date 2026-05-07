import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useReportFilters } from "@/lib/reports/filters";
import { useReportsData } from "@/lib/queries/reports";
import { ReportsProvider } from "@/lib/reports/context";
import { ReportsHeader } from "@/components/reports/ReportsHeader";
import { ExecutiveSummaryAI } from "@/components/reports/ExecutiveSummaryAI";
import { BusinessInsightsCard } from "@/components/reports/BusinessInsightsCard";
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
  const { data, isLoading, users } = useReportsData(filters);
  const [executiveSummary, setExecutiveSummary] = useState<string | undefined>(undefined);
  const [updatedAt] = useState(() => new Date());

  const funnelRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);

  const generatedBy = user?.email ?? user?.user_metadata?.full_name ?? "Walix user";

  return (
    <ReportsProvider value={{ data, isLoading, users }}>
      <div className="space-y-6">
        <ReportsHeader
          filters={filters}
          onPeriod={setPeriod}
          onSellers={setSellers}
          chartRefs={{ funnel: funnelRef.current, pie: pieRef.current, heatmap: heatmapRef.current }}
          executiveSummary={executiveSummary}
          generatedBy={generatedBy}
        />

        <ExecutiveSummaryAI onSummaryReady={setExecutiveSummary} />

        <BusinessInsightsCard />

        <KpiHeroRow />

        <div ref={funnelRef}>
          <SalesFunnelChart />
        </div>

        <SellerPerformanceTable />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div ref={pieRef}>
            <LeadSourcesPie />
          </div>
          <LostDealsChart />
        </div>

        <div ref={heatmapRef}>
          <TeamActivityHeatmap />
        </div>

        <StageConversionsSection />

        <div className="text-xs text-muted-foreground text-center pt-2 pb-6">
          Última actualización: {updatedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </ReportsProvider>
  );
}