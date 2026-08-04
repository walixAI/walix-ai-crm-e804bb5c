import { Card } from "@/components/ui/card";
import { WBadge } from "@/components/walix/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAiModelCatalog, usePlatformTenantsAi, useSetTenantModel } from "@/lib/queries/aiModels";
import { tenantPlanLabel, aiVendorLabel, formatMXN } from "@/lib/plans";
import { toast } from "sonner";

export function TenantAiModelTable() {
  const { data: tenants = [], isLoading } = usePlatformTenantsAi();
  const { data: catalog = [] } = useAiModelCatalog();
  const setModel = useSetTenantModel();

  async function change(tenantId: string, modelId: string) {
    const entry = catalog.find((c) => c.model_id === modelId);
    if (!entry) return;
    try {
      await setModel.mutateAsync({ tenantId, vendor: entry.vendor, model: entry.model_id });
      toast.success(`Motor actualizado a ${entry.commercial_name}`);
    } catch {
      toast.error("No se pudo cambiar el motor de IA");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        Motor de IA por instancia ({tenants.length})
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Instancia</th>
                <th className="text-left px-5 py-2 font-medium">Plan</th>
                <th className="text-left px-5 py-2 font-medium">MRR</th>
                <th className="text-left px-5 py-2 font-medium">Proveedor</th>
                <th className="text-left px-5 py-2 font-medium w-[280px]">Motor asignado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{t.name}</td>
                  <td className="px-5 py-3"><WBadge variant="brand">{tenantPlanLabel(t.plan)}</WBadge></td>
                  <td className="px-5 py-3">{formatMXN(Number(t.mrr ?? 0))}</td>
                  <td className="px-5 py-3 text-muted-foreground">{aiVendorLabel(t.ai_vendor)}</td>
                  <td className="px-5 py-3">
                    <Select value={t.ai_model ?? undefined} onValueChange={(v) => change(t.id, v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        {catalog.map((c) => (
                          <SelectItem key={c.model_id} value={c.model_id}>
                            {c.commercial_name} · {c.credit_factor}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
        Solo el dueño de la plataforma puede asignar el motor. Por defecto todas las instancias usan el motor más económico.
      </p>
    </Card>
  );
}
