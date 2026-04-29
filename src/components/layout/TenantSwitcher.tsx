import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Plus, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenants, useOrgPlanLimits } from "@/lib/queries/organizations";
import { switchTenant } from "@/services/organizations";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CreateTenantDialog } from "@/components/organizations/CreateTenantDialog";
import { usePermissions } from "@/hooks/usePermissions";

export function TenantSwitcher() {
  const { activeTenantId, organizations } = useAuth();
  const { isOrgOwner } = usePermissions();
  const { data: tenants = [], isLoading } = useUserTenants();
  const { data: limits = [] } = useOrgPlanLimits();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  // Org primaria: la primera donde el usuario es org_owner, si no la primera membership
  const primaryOrg =
    organizations.find((o) => o.role === "org_owner") ?? organizations[0];
  const tenantsInPrimaryOrg = primaryOrg
    ? tenants.filter((t) => t.organization_id === primaryOrg.organization_id)
    : tenants;
  const planLimit = primaryOrg
    ? limits.find((l) => l.plan === (organizations.find((o) => o.organization_id === primaryOrg.organization_id) as any)?.plan)
    : null;

  const active = tenants.find((t) => t.id === activeTenantId);

  // Plan label desde organizations no está expuesto; usamos count vs limit
  const orgPlan = (organizations as any).find((o: any) => o.organization_id === primaryOrg?.organization_id)?.plan ?? "org_starter";
  const limitForOrg = limits.find((l) => l.plan === orgPlan);
  const reachedLimit =
    limitForOrg != null && tenantsInPrimaryOrg.length >= limitForOrg.max_tenants;

  const onSwitch = async (id: string) => {
    if (id === activeTenantId) return;
    try {
      await switchTenant(id);
      toast({ title: "Empresa cambiada", description: "Recargando datos..." });
      // Invalidar todo el caché y recargar
      qc.invalidateQueries();
      setTimeout(() => window.location.reload(), 300);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  if (isLoading || tenants.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 h-9 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Cargando…</span>
      </div>
    );
  }

  // Si solo hay 1 tenant y NO es org_owner, mostrar como label simple
  if (tenants.length === 1 && !isOrgOwner) {
    return (
      <div className="flex items-center gap-2 px-2 h-9 rounded-lg text-sm">
        <div className="h-7 w-7 rounded-md bg-gradient-brand grid place-items-center text-primary-foreground text-[11px] font-bold">
          {active?.name?.[0] ?? "T"}
        </div>
        <span className="font-medium truncate max-w-[140px]">{active?.name}</span>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 px-2 gap-2 hover:bg-muted/70 rounded-lg"
          >
            <div className="h-7 w-7 rounded-md bg-gradient-brand grid place-items-center text-primary-foreground text-[11px] font-bold">
              {active?.name?.[0] ?? "T"}
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold truncate max-w-[140px]">
                {active?.name ?? "Selecciona empresa"}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Plan {active?.plan ?? "—"}
              </span>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Tus empresas
          </DropdownMenuLabel>
          {tenants.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => onSwitch(t.id)}
              className="gap-2"
            >
              <div className="h-6 w-6 rounded bg-muted grid place-items-center text-[10px] font-bold">
                {t.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  Plan {t.plan}
                </div>
              </div>
              {t.id === activeTenantId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          {isOrgOwner && primaryOrg && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={reachedLimit}
                onClick={() => !reachedLimit && setCreateOpen(true)}
                className="gap-2 text-primary focus:text-primary"
              >
                {reachedLimit ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {reachedLimit ? "Límite de empresas alcanzado" : "Nueva empresa"}
                  </div>
                  {reachedLimit && limitForOrg && (
                    <div className="text-[10px] text-muted-foreground">
                      Plan permite {limitForOrg.max_tenants}. Mejora tu plan.
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {primaryOrg && (
        <CreateTenantDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={primaryOrg.organization_id}
        />
      )}
    </>
  );
}
