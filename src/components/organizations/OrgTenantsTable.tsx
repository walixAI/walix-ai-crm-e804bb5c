import { Card } from "@/components/ui/card";
import { WBadge } from "@/components/walix/Badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { switchTenant } from "@/services/organizations";
import { useToast } from "@/hooks/use-toast";
import type { OrgTenant } from "@/lib/queries/organizations";
import { useQueryClient } from "@tanstack/react-query";
import { tenantPlanLabel } from "@/lib/plans";
import { TenantMark } from "@/components/walix/TenantMark";

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

interface Props {
  tenants: OrgTenant[];
  activeTenantId: string | null;
}

export function OrgTenantsTable({ tenants, activeTenantId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const onOpen = async (id: string) => {
    if (id === activeTenantId) return;
    await switchTenant(id);
    toast({ title: "Cambiando a empresa…" });
    qc.invalidateQueries();
    setTimeout(() => (window.location.href = "/dashboard"), 300);
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        Empresas ({tenants.length})
      </div>
      {tenants.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Aún no tienes empresas creadas.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Empresa</th>
                <th className="text-left px-5 py-2 font-medium">Plan</th>
                <th className="text-left px-5 py-2 font-medium">Usuarios</th>
                <th className="text-left px-5 py-2 font-medium">Último acceso</th>
                <th className="text-left px-5 py-2 font-medium">MRR</th>
                <th className="text-left px-5 py-2 font-medium">Estado</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">
                    <span className="inline-flex items-center gap-2 align-middle">
                      <TenantMark name={t.name} logoUrl={(t as any).logo_url} size={24} />
                      {t.name}
                    </span>
                    {t.id === activeTenantId && (
                      <WBadge variant="brand" className="ml-2 text-[10px]">
                        Activa
                      </WBadge>
                    )}
                    {t.trial_ends_at && new Date(t.trial_ends_at) > new Date() && (
                      <WBadge variant="warning" className="ml-2 text-[10px]">
                        Trial
                      </WBadge>
                    )}
                  </td>
                  <td className="px-5 py-3">{tenantPlanLabel(t.plan)}</td>
                  <td className="px-5 py-3">{t.active_users}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {t.last_activity_at
                      ? formatDistanceToNow(new Date(t.last_activity_at), {
                          locale: es,
                          addSuffix: true,
                        })
                      : "—"}
                  </td>
                  <td className="px-5 py-3 font-semibold">{fmt(Number(t.mrr ?? 0))}</td>
                  <td className="px-5 py-3">
                    <WBadge variant={t.status === "active" ? "success" : "danger"}>
                      {t.status === "active" ? "Activo" : "Suspendido"}
                    </WBadge>
                  </td>
                  <td className="px-5 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpen(t.id)}
                      disabled={t.id === activeTenantId}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
