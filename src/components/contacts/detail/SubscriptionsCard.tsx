import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useContactSubscriptions, useSetSubscriptionStatus, type ContactSubscription,
} from "@/lib/queries/recurrenceSubscriptions";

const periodLabel = (m?: number | null) =>
  m === 1 ? "Mensual" : m === 3 ? "Trimestral" : m === 6 ? "Semestral" : m === 12 ? "Anual" : "Periódico";

const fmt = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function SubscriptionsCard({ contactId }: { contactId: string }) {
  const { data: subs = [], isLoading } = useContactSubscriptions(contactId);
  const setStatus = useSetSubscriptionStatus();
  const [target, setTarget] = useState<ContactSubscription | null>(null);
  const [reason, setReason] = useState("");

  if (isLoading || subs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Repeat className="h-4 w-4" /> Suscripciones de servicio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {subs.map((s) => {
          const cancelled = s.status === "cancelled";
          return (
            <div key={s.id} className="rounded-md border p-2.5 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.recurrence?.name ?? "Servicio"}</p>
                  <p className="text-xs text-muted-foreground">
                    {periodLabel(s.recurrence?.period_months)} · próxima {fmt(s.next_due_date)}
                  </p>
                </div>
                <Badge variant="secondary" className={cancelled ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success"}>
                  {cancelled ? "Dada de baja" : s.status === "paused" ? "En pausa" : "Activa"}
                </Badge>
              </div>
              {!cancelled && s.upcoming.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Agenda: {s.upcoming.slice(0, 2).map((o) => fmt(o.due_date)).join(" · ")}
                </p>
              )}
              {cancelled ? (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() =>
                    setStatus.mutate({ id: s.id, status: "active" }, {
                      onSuccess: () => toast.success("Suscripción reactivada"),
                    })
                  }
                >
                  Reactivar
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setTarget(s)}>
                  Dar de baja
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dar de baja la suscripción</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ya no se generarán nuevas oportunidades ni recordatorios de {target?.recurrence?.name}.
          </p>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={setStatus.isPending}
              onClick={() =>
                target &&
                setStatus.mutate({ id: target.id, status: "cancelled", reason }, {
                  onSuccess: () => { toast.success("Suscripción dada de baja"); setTarget(null); setReason(""); },
                })
              }
            >
              Dar de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}