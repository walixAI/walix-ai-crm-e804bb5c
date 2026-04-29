import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAutomationRuns, type Automation } from "@/lib/queries/automations";
import { WBadge } from "@/components/walix/Badge";
import { CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import { timeAgo } from "@/lib/automations/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  automation: Automation | null;
}

export function AutomationHistoryDrawer({ open, onOpenChange, automation }: Props) {
  const { data: runs = [], isLoading } = useAutomationRuns(automation?.id);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-card overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Historial de ejecuciones</SheetTitle>
          {automation && <p className="text-xs text-muted-foreground">{automation.name}</p>}
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && runs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Aún no hay ejecuciones registradas.</p>
              <p className="text-xs text-muted-foreground mt-1">Cuando esta automatización se dispare, verás aquí cada corrida.</p>
            </div>
          )}
          {runs.map((r) => {
            const Icon = r.status === "success" ? CheckCircle2 : r.status === "error" ? XCircle : FlaskConical;
            const variant = r.status === "success" ? "success" : r.status === "error" ? "danger" : "info";
            return (
              <div key={r.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${r.status === "success" ? "text-success" : r.status === "error" ? "text-danger" : "text-info"}`} />
                    <WBadge variant={variant as any}>{r.status === "dry_run" ? "Simulación" : r.status === "success" ? "Éxito" : "Error"}</WBadge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </div>
                {r.entityType && <p className="text-xs text-muted-foreground mt-2">Entidad: <span className="font-mono">{r.entityType}</span></p>}
                {r.errorMessage && <p className="text-xs text-danger mt-1">{r.errorMessage}</p>}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
