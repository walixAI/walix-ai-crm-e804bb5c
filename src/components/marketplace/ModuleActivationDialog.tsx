import { Check, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { cn } from "@/lib/utils";
import { PLAN_LABEL, type ModuleDef } from "@/lib/marketplace/catalog";

interface Props {
  module: ModuleDef | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function ModuleActivationDialog({ module: mod, open, onClose, onConfirm, loading }: Props) {
  if (!mod) return null;
  const Icon = mod.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-start gap-4 mb-2">
            <div className={cn("h-14 w-14 rounded-xl grid place-items-center shrink-0", mod.bgClass)}>
              <Icon className={cn("h-7 w-7", mod.iconClass)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{mod.category}</p>
              <DialogTitle className="text-xl">{mod.name}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            {mod.longDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <h4 className="text-sm font-semibold mb-2">Incluye</h4>
            <ul className="space-y-1.5">
              {mod.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Este módulo estará disponible próximamente. Mientras tanto puedes explorar
              sus funciones.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cerrar
          </Button>
          <Button disabled>
            Próximamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}