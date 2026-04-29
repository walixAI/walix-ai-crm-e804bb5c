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

          <div>
            <h4 className="text-sm font-semibold mb-2">Requisitos</h4>
            <div className="flex flex-wrap gap-2 text-sm">
              <WBadge variant="brand">Plan mínimo: {PLAN_LABEL[mod.minPlan]}</WBadge>
              {mod.notes && <WBadge variant="neutral">{mod.notes}</WBadge>}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Precio</span>
              <div className="text-right">
                <div className="font-semibold">{mod.priceLabel}</div>
                <div className="text-xs text-muted-foreground">{mod.priceUnitLabel}</div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              El cobro se activará cuando conectemos facturación. Por ahora la activación es
              sin costo durante la beta.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Activando..." : `Activar módulo${mod.monthlyPriceMxn > 0 ? ` — $${mod.monthlyPriceMxn} MXN/mes` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}