import { Card } from "@/components/ui/card";
import { useAuditLog } from "@/lib/queries/auditLog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, Loader2 } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  "tenant.updated": "Actualizó la información de la empresa",
  "team.member.activated": "Activó a un miembro",
  "team.member.deactivated": "Desactivó a un miembro",
  "team.invite.sent": "Envió una invitación",
  "team.invite.revoked": "Revocó una invitación",
  "pipeline.created": "Creó un pipeline",
  "pipeline.stages.updated": "Actualizó las etapas de un pipeline",
  "automation.created": "Creó una automatización",
  "automation.toggled": "Cambió el estado de una automatización",
};

function actionLabel(action: string) {
  return ACTION_LABEL[action] ?? action;
}

export function ActivityTab({ tenantId }: { tenantId: string }) {
  const { data: entries = [], isLoading } = useAuditLog(tenantId);

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        Actividad reciente
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando...
        </div>
      ) : entries.length === 0 ? (
        <div className="p-12 text-center">
          <Activity className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Las acciones importantes (cambios de plan, invitaciones, etapas) aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-5 py-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center shrink-0 mt-0.5">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium">{e.actor_email ?? "Sistema"}</span>{" "}
                  <span className="text-muted-foreground">{actionLabel(e.action).toLowerCase()}</span>
                </div>
                {e.metadata && Object.keys(e.metadata).length > 0 && (
                  <pre className="text-[10px] text-muted-foreground bg-muted rounded mt-1 px-2 py-1 overflow-x-auto">
                    {JSON.stringify(e.metadata, null, 0)}
                  </pre>
                )}
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(e.created_at), { locale: es, addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}