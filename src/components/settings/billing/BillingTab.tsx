import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { ArrowRight, Check } from "lucide-react";
import { fetchTenant } from "@/services/tenant";
import { usePlanLimits } from "@/lib/queries/planLimits";
import { tenantPlanLabel, limitLabel, formatMXN } from "@/lib/plans";
import { CreditsCard } from "./CreditsCard";
import { AiEngineCard } from "./AiEngineCard";
import { AiUsageBreakdown } from "./AiUsageBreakdown";
import { WhatsappUsageBreakdown } from "./WhatsappUsageBreakdown";
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
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Plan actual</p>
            <h2 className="text-3xl font-bold mt-1">{tenantPlanLabel(currentPlan)}</h2>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-border">
            <Stat label="Usuarios" value={limitLabel(limit.max_users)} />
            <Stat label="Automatizaciones" value={limitLabel(limit.max_active_automations, "Ilimitadas")} />
            <Stat label="Pipelines" value={limitLabel(limit.max_pipelines)} />
            <Stat label="Créditos WhatsApp" value={`${limit.whatsapp_credits}/mes`} />
            <Stat label="Créditos IA" value={`${limit.ai_credits.toLocaleString("es-MX")}/mes`} />
          </div>
        )}
      </Card>

      <CreditsCard tenantId={tenantId} plan={currentPlan} />

      <AiUsageBreakdown tenantId={tenantId} />

      {isTenantAdmin && <WhatsappUsageBreakdown tenantId={tenantId} />}

      <AiEngineCard
        tenantId={tenantId}
        plan={currentPlan}
        vendor={tenant?.ai_vendor ?? "gemini"}
        model={tenant?.ai_model ?? null}
      />

      <InvoiceHistoryCard
        tenantId={tenantId}
        tenantName={tenant?.name ?? "Mi empresa"}
        planLabel={tenantPlanLabel(currentPlan)}
        fallbackPrice={limit?.monthly_price ?? 0}
        includedAiCredits={limit?.ai_credits}
        includedWaCredits={limit?.whatsapp_credits}
        fallbackInvoices={invoices}
      />


      <p className="text-xs text-muted-foreground text-center">
        Las facturas se generan automáticamente. Para datos fiscales, contacta a soporte.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}