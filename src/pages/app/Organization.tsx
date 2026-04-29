import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Building2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  useOrganization,
  useOrgTenants,
  useOrgPlanLimits,
} from "@/lib/queries/organizations";
import { OrgPlanCard } from "@/components/organizations/OrgPlanCard";
import { OrgTenantsTable } from "@/components/organizations/OrgTenantsTable";
import { CreateTenantDialog } from "@/components/organizations/CreateTenantDialog";

export default function Organization() {
  const { organizations, activeTenantId } = useAuth();
  const primary = organizations.find((o) => o.role === "org_owner") ?? organizations[0];
  const [createOpen, setCreateOpen] = useState(false);

  const { data: org } = useOrganization(primary?.organization_id);
  const { data: tenants = [], isLoading } = useOrgTenants(primary?.organization_id);
  const { data: limits = [] } = useOrgPlanLimits();
  const limit = limits.find((l) => l.plan === org?.plan);
  const reached = limit ? tenants.length >= limit.max_tenants : false;

  if (!primary) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Sin organización</h1>
        <p className="text-muted-foreground">No perteneces a ninguna organización.</p>
      </div>
    );
  }

  const totalUsers = tenants.reduce((s, t) => s + t.active_users, 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org?.name ?? primary.organization_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista general de tu organización y empresas.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={reached}>
          <Plus className="h-4 w-4 mr-2" /> Nueva empresa
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OrgPlanCard
          plan={org?.plan ?? "org_starter"}
          tenantCount={tenants.length}
          limit={limit}
        />
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Empresas</p>
              <p className="text-xl font-bold">{tenants.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Usuarios totales</p>
              <p className="text-xl font-bold">{totalUsers}</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando empresas…
        </Card>
      ) : (
        <OrgTenantsTable tenants={tenants} activeTenantId={activeTenantId} />
      )}

      <CreateTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={primary.organization_id}
      />
    </div>
  );
}
