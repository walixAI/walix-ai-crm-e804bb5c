import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { fetchTenant } from "@/services/tenant";
import { usePlanLimits } from "@/lib/queries/planLimits";
import { tenantPlanLabel, limitLabel, formatMXN } from "@/lib/plans";
import { CreditsCard } from "./CreditsCard";
import { AiEngineCard } from "./AiEngineCard";
import { AiUsageBreakdown } from "./AiUsageBreakdown";
import { WhatsappUsageBreakdown } from "./WhatsappUsageBreakdown";
import { InvoiceHistoryCard } from "./InvoiceHistoryCard";
import { MonthlyUsageSummary } from "./MonthlyUsageSummary";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePermissions } from "@/hooks/usePermissions";

/** Genera el historial de facturas desde el mes de inicio de facturación del tenant hasta hoy. */
function buildInvoices(startDate: string | null | undefined) {
  if (!startDate) return [];
  const [y, m] = startDate.slice(0, 10).split("-").map(Number);
  if (!y || !m) return [];
  const now = new Date();
  const out: { id: string; date: string }[] = [];
  let cur = new Date(y, m - 1, 1);
  while (cur.getFullYear() < now.getFullYear() || (cur.getFullYear() === now.getFullYear() && cur.getMonth() <= now.getMonth())) {
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    out.push({ id: `INV-${cur.getFullYear()}-${mm}`, date: `${cur.getFullYear()}-${mm}-01` });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out.reverse();
}

export function BillingTab({ tenantId }: { tenantId: string }) {
  const { can, isTenantAdmin } = usePermissions();
  const { data: tenant } = useQuery({ queryKey: ["tenant", tenantId], queryFn: () => fetchTenant(tenantId) });
  const { data: limits } = usePlanLimits();
  const currentPlan = tenant?.plan ?? "pyme";
  const limit = limits?.[currentPlan];
  const fmt = formatMXN;

  const renewDate = new Date(); renewDate.setDate(1); renewDate.setMonth(renewDate.getMonth() + 1);
  const invoices = buildInvoices(tenant?.billing_start_date);

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Plan actual</p>
            <h2 className="text-2xl font-bold mt-1">{tenantPlanLabel(currentPlan)}</h2>
            {limit && (
              <p className="text-sm text-muted-foreground mt-1">
                {fmt(limit.monthly_price)} / mes · próximo cargo {renewDate.toLocaleDateString("es-MX")}
              </p>
            )}
          </div>
          {can("billing.manage") && (
            <Button>
              Cambiar plan <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {limit && (
          <p className="text-xs text-muted-foreground mt-3">
            Incluye {limitLabel(limit.max_users)} usuarios · {limitLabel(limit.max_pipelines)} pipelines · {limit.ai_credits.toLocaleString("es-MX")} créditos IA · {limit.whatsapp_credits} créditos WhatsApp al mes
          </p>
        )}
      </Card>

      <MonthlyUsageSummary tenantId={tenantId} plan={currentPlan} />

      <Accordion type="multiple" className="rounded-lg border border-border bg-card px-4">
        <AccordionItem value="packs">
          <AccordionTrigger className="text-sm">Comprar créditos adicionales</AccordionTrigger>
          <AccordionContent><CreditsCard tenantId={tenantId} plan={currentPlan} /></AccordionContent>
        </AccordionItem>
        <AccordionItem value="ai">
          <AccordionTrigger className="text-sm">Detalle de uso de IA</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <AiUsageBreakdown tenantId={tenantId} />
            <AiEngineCard tenantId={tenantId} plan={currentPlan} vendor={tenant?.ai_vendor ?? "gemini"} model={tenant?.ai_model ?? null} />
          </AccordionContent>
        </AccordionItem>
        {isTenantAdmin && (
          <AccordionItem value="wa">
            <AccordionTrigger className="text-sm">Detalle de WhatsApp</AccordionTrigger>
            <AccordionContent><WhatsappUsageBreakdown tenantId={tenantId} /></AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="inv" className="border-b-0">
          <AccordionTrigger className="text-sm">Facturas</AccordionTrigger>
          <AccordionContent>
            <InvoiceHistoryCard
              tenantId={tenantId}
              tenantName={tenant?.name ?? "Mi empresa"}
              planLabel={tenantPlanLabel(currentPlan)}
              fallbackPrice={limit?.monthly_price ?? 0}
              includedAiCredits={limit?.ai_credits}
              includedWaCredits={limit?.whatsapp_credits}
              fallbackInvoices={invoices}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p className="text-xs text-muted-foreground text-center">
        Las facturas se generan automáticamente. Para datos fiscales, contacta a soporte.
      </p>
    </div>
  );
}

