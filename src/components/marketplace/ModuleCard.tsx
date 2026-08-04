import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { cn } from "@/lib/utils";
import {
  type ModuleDef,
  type ModuleStatus,
} from "@/lib/marketplace/catalog";

interface Props {
  module: ModuleDef;
  status: ModuleStatus;
  onManage: () => void;
}

export function ModuleCard({ module: mod, status, onManage }: Props) {
  const Icon = mod.icon;

  const statusBadge = () => {
    switch (status) {
      case "active":
        return <WBadge variant="success">Activo</WBadge>;
      default:
        return <WBadge variant="neutral">Próximamente</WBadge>;
    }
  };

  const cta = () => {
    if (status === "active") {
      return (
        <Button variant="outline" className="w-full" onClick={onManage}>
          Gestionar
        </Button>
      );
    }
    return (
      <Button variant="ghost" className="w-full" disabled>
        Próximamente
      </Button>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-card-hover transition-all flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-16 w-16 rounded-xl grid place-items-center shrink-0 relative",
            mod.bgClass,
          )}
        >
          <Icon className={cn("h-8 w-8", mod.iconClass)} />
          {status === "plan_locked" && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border border-border grid place-items-center">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-base leading-tight">{mod.name}</h3>
            {statusBadge()}
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {mod.category}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">{mod.shortDescription}</p>

      <div className="mt-auto" />

      {cta()}
    </div>
  );
}