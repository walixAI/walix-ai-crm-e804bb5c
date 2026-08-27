import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { useCampaignLog, useCampaignMetrics, type WaCampaign } from "@/lib/queries/whatsappCampaigns";

interface Props {
  campaign: WaCampaign | null;
  onOpenChange: (v: boolean) => void;
}

const STATUS_LABEL: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
  cancelled: "Cancelado",
  pending_template: "Requiere plantilla",
  scheduled: "Programado",
};

export function CampaignMetricsDrawer({ campaign, onOpenChange }: Props) {
  const { data: metrics } = useCampaignMetrics(campaign?.id);
  const { data: log = [] } = useCampaignLog(campaign?.id);

  return (
    <Sheet open={!!campaign} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{campaign?.name}</SheetTitle>
          <SheetDescription>Métricas y bitácora de envíos de la campaña.</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 mt-5">
          {metrics && Object.entries(metrics).map(([k, v]) => (
            <Card key={k}>
              <CardContent className="p-3">
                <p className="text-xl font-semibold">{v as number}</p>
                <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium">Bitácora</p>
          {log.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay envíos registrados.</p>}
          {log.map((row: any) => (
            <div key={row.id} className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{row.contacts?.name ?? "Contacto"}</p>
                <p className="text-xs text-muted-foreground">
                  Paso {(row.step_order ?? 0) + 1} · {format(new Date(row.sent_at ?? row.created_at), "dd/MM/yy HH:mm")}
                </p>
                {row.error_message && <p className="text-xs text-destructive mt-1">{row.error_message}</p>}
              </div>
              <Badge variant={row.status === "sent" ? "secondary" : row.status === "failed" ? "destructive" : "outline"}>
                {STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
