import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { Building2, DollarSign, TrendingDown, Smile, Loader2 } from "lucide-react";
import { useAllTenants, useGlobalKpis } from "@/lib/queries/admin";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function SuperAdmin() {
  const { data: tenants = [], isLoading } = useAllTenants();
  const { totalTenants, totalMrr, avgNps, churnRate } = useGlobalKpis();
  const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SuperAdmin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión global de instancias, planes y métricas de negocio.
          </p>
        </div>
        <Button>+ Crear instancia</Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Building2} label="Tenants totales" value={totalTenants.toString()} />
        <Kpi icon={DollarSign} label="MRR total" value={fmt(totalMrr)} />
        <Kpi icon={TrendingDown} label="Churn rate" value={`${churnRate.toFixed(1)}%`} />
        <Kpi icon={Smile} label="NPS promedio" value={avgNps != null ? `${avgNps}` : "—"} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Instancias ({tenants.length})
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando...
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay instancias.</div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{t.name}</td>
                    <td className="px-5 py-3 capitalize">{t.plan}</td>
                    <td className="px-5 py-3">{t.active_users}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {t.last_activity_at
                        ? formatDistanceToNow(new Date(t.last_activity_at), { locale: es, addSuffix: true })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold">{fmt(Number(t.mrr ?? 0))}</td>
                    <td className="px-5 py-3">
                      <WBadge variant={t.status === "active" ? "success" : "danger"}>
                        {t.status === "active" ? "Activo" : "Suspendido"}
                      </WBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}