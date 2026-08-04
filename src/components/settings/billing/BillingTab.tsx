import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { Download, ArrowRight, Check } from "lucide-react";
import { fetchTenant } from "@/services/tenant";
import { usePlanLimits } from "@/lib/queries/planLimits";
import { tenantPlanLabel, limitLabel, formatMXN } from "@/lib/plans";
import { CreditsCard } from "./CreditsCard";
import { AiEngineCard } from "./AiEngineCard";

const INVOICES = [
  { id: "INV-2026-04", date: "2026-04-01", status: "paid" },
  { id: "INV-2026-03", date: "2026-03-01", status: "paid" },
  { id: "INV-2026-02", date: "2026-02-01", status: "paid" },
];

export function BillingTab({ tenantId }: { tenantId: string }) {
  const { data: tenant } = useQuery({ queryKey: ["tenant", tenantId], queryFn: () => fetchTenant(tenantId) });
  const { data: limits } = usePlanLimits();
  const currentPlan = tenant?.plan ?? "pyme";
  const limit = limits?.[currentPlan];
  const fmt = formatMXN;

  const renewDate = new Date(); renewDate.setDate(1); renewDate.setMonth(renewDate.getMonth() + 1);

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
          <Button>
            Cambiar plan <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
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

      <AiEngineCard
        tenantId={tenantId}
        plan={currentPlan}
        vendor={tenant?.ai_vendor ?? "gemini"}
        model={tenant?.ai_model ?? null}
      />

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Historial de facturas
        </div>
        <div className="divide-y divide-border">
          {INVOICES.map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{inv.id}</div>
                <div className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString("es-MX")}</div>
              </div>
              <div className="text-sm font-semibold">{fmt(limit?.monthly_price ?? 0)}</div>
              <WBadge variant="success"><Check className="h-3 w-3" /> Pagado</WBadge>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          ))}
        </div>
      </Card>

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