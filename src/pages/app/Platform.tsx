import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { Building2, DollarSign, Users, Layers, Loader2, ChevronRight } from "lucide-react";
import { usePlatformOrgs, usePlatformKpis } from "@/lib/queries/platform";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";

export default function Platform() {
  const { data: orgs = [], isLoading } = usePlatformOrgs();
  const { totalOrgs, totalTenants, totalMrr, totalMembers } = usePlatformKpis();
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plataforma Walix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista global de organizaciones, instancias e ingresos.
          </p>
        </div>
        <Link to="/admin">
          <Button variant="outline">Ver instancias (legacy)</Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Building2} label="Organizaciones" value={totalOrgs.toString()} />
        <Kpi icon={Layers} label="Instancias totales" value={totalTenants.toString()} />
        <Kpi icon={DollarSign} label="MRR consolidado" value={fmt(totalMrr)} />
        <Kpi icon={Users} label="Miembros totales" value={totalMembers.toString()} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Organizaciones ({orgs.length})
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando...
          </div>
        ) : orgs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay organizaciones aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">Organización</th>
                  <th className="text-left px-5 py-2 font-medium">Owner</th>
                  <th className="text-left px-5 py-2 font-medium">Plan</th>
                  <th className="text-left px-5 py-2 font-medium">Instancias</th>
                  <th className="text-left px-5 py-2 font-medium">Miembros</th>
                  <th className="text-left px-5 py-2 font-medium">MRR</th>
                  <th className="text-left px-5 py-2 font-medium">Creada</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orgs.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{o.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{o.owner_email ?? "—"}</td>
                    <td className="px-5 py-3">
                      <WBadge variant="brand">{o.plan.replace("org_", "")}</WBadge>
                    </td>
                    <td className="px-5 py-3">{o.tenant_count}</td>
                    <td className="px-5 py-3">{o.member_count}</td>
                    <td className="px-5 py-3 font-semibold">{fmt(o.total_mrr)}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(o.created_at), { locale: es, addSuffix: true })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
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
