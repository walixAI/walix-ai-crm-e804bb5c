import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Package } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  MODULE_CATALOG,
  resolveStatus,
  type ModuleCategory,
  type ModuleDef,
  type ModuleStatus,
} from "@/lib/marketplace/catalog";
import {
  useActiveModules,
  useActivateModule,
  useDeactivateModule,
  useTenantPlan,
} from "@/lib/queries/marketplace";
import { ModuleCard } from "@/components/marketplace/ModuleCard";
import { ModuleActivationDialog } from "@/components/marketplace/ModuleActivationDialog";
import { ManageModuleDialog } from "@/components/marketplace/ManageModuleDialog";

type Tab = "all" | "active" | "available" | "coming_soon";

export default function Marketplace() {
  const navigate = useNavigate();
  const { data: plan } = useTenantPlan();
  const { data: active = [] } = useActiveModules();
  const activate = useActivateModule();
  const deactivate = useDeactivateModule();

  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState<ModuleCategory | "all">("all");
  const [activateMod, setActivateMod] = useState<ModuleDef | null>(null);
  const [manageMod, setManageMod] = useState<ModuleDef | null>(null);

  const activeIds = useMemo(() => new Set(active.map((m) => m.module_id)), [active]);

  const itemsWithStatus = useMemo(
    () =>
      MODULE_CATALOG.map((mod) => ({
        mod,
        status: resolveStatus(mod, activeIds.has(mod.id), plan),
      })),
    [activeIds, plan],
  );

  const filtered = itemsWithStatus.filter(({ mod, status }) => {
    if (category !== "all" && mod.category !== category) return false;
    if (tab === "active") return status === "active";
    if (tab === "available") return status === "available" || status === "plan_locked";
    if (tab === "coming_soon") return status === "coming_soon";
    return true;
  });

  // Por ahora no se muestran totales de add-ons porque todo está próximamente.
  const monthlyTotal = 0;

  const handleActivate = async () => {
    if (!activateMod) return;
    try {
      await activate.mutateAsync(activateMod);
      toast.success(`${activateMod.name} activado`);
      setActivateMod(null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo activar el módulo");
    }
  };

  const handleDeactivate = async () => {
    if (!manageMod) return;
    try {
      await deactivate.mutateAsync(manageMod.id);
      toast.success(`${manageMod.name} desactivado`);
      setManageMod(null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo desactivar el módulo");
    }
  };

  const manageRow = manageMod ? active.find((a) => a.module_id === manageMod.id) : undefined;

  return (
    <div className="max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-brand grid place-items-center shadow-glow">
            <Store className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Marketplace de Módulos</h1>
            <p className="text-sm text-muted-foreground">
              Expande tu CRM con módulos especializados
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 text-right">
          <div className="text-xs text-muted-foreground">Add-ons activos</div>
          <div className="font-semibold">—</div>
          <div className="text-xs text-muted-foreground">Próximamente</div>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="active">
            Activos {active.length > 0 && <span className="ml-1.5 text-xs">({active.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="available">Disponibles</TabsTrigger>
          <TabsTrigger value="coming_soon">Próximamente</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
          Todas
        </CategoryChip>
        {CATEGORIES.map((c) => (
          <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </CategoryChip>
        ))}
      </div>

      {/* Active modules summary (only on Active tab) */}
      {tab === "active" && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Total de add-ons</div>
            <div className="text-xs text-muted-foreground">Adicional a tu plan base</div>
          </div>
          <div className="text-xl font-bold">—</div>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold">Sin módulos en esta vista</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cambia de categoría o pestaña para ver más opciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(({ mod, status }) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              status={status as ModuleStatus}
              onManage={() => setManageMod(mod)}
            />
          ))}
        </div>
      )}

      <ModuleActivationDialog
        module={activateMod}
        open={!!activateMod}
        onClose={() => setActivateMod(null)}
        onConfirm={handleActivate}
        loading={activate.isPending}
      />

      <ManageModuleDialog
        module={manageMod}
        activatedAt={manageRow?.activated_at}
        open={!!manageMod}
        onClose={() => setManageMod(null)}
        onDeactivate={handleDeactivate}
        loading={deactivate.isPending}
      />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn("rounded-full h-8", !active && "bg-card")}
    >
      {children}
    </Button>
  );
}