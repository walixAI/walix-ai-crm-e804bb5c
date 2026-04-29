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
import { type ModuleDef } from "@/lib/marketplace/catalog";

interface Props {
  module: ModuleDef | null;
  activatedAt?: string;
  open: boolean;
  onClose: () => void;
  onDeactivate: () => void;
  loading?: boolean;
}

export function ManageModuleDialog({ module: mod, activatedAt, open, onClose, onDeactivate, loading }: Props) {
  if (!mod) return null;
  const Icon = mod.icon;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3 mb-2">
            <div className={cn("h-12 w-12 rounded-xl grid place-items-center shrink-0", mod.bgClass)}>
              <Icon className={cn("h-6 w-6", mod.iconClass)} />
            </div>
            <div>
              <DialogTitle>{mod.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">{mod.category}</p>
            </div>
          </div>
          <DialogDescription>{mod.shortDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Estado</span><WBadge variant="success">Activo</WBadge></div>
          {activatedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Activado el</span>
              <span>{new Date(activatedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Costo</span>
            <span className="font-medium">{mod.priceLabel}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cerrar</Button>
          <Button variant="destructive" onClick={onDeactivate} disabled={loading}>
            {loading ? "Desactivando..." : "Desactivar módulo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}