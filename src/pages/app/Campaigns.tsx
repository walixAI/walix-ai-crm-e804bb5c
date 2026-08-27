import { useState } from "react";
import { Plus, Send, RefreshCw, BarChart3, Pencil, Trash2, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CampaignDialog } from "@/components/campaigns/CampaignDialog";
import { CampaignMetricsDrawer } from "@/components/campaigns/CampaignMetricsDrawer";
import { SegmentSendDialog } from "@/components/campaigns/SegmentSendDialog";
import {
  OBJECTIVES, useCampaigns, useDeleteCampaign, useSyncTemplates, useToggleCampaign,
  type WaCampaign,
} from "@/lib/queries/whatsappCampaigns";

export default function Campaigns() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const toggle = useToggleCampaign();
  const del = useDeleteCampaign();
  const sync = useSyncTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WaCampaign | null>(null);
  const [metrics, setMetrics] = useState<WaCampaign | null>(null);
  const [segmentOpen, setSegmentOpen] = useState(false);

  const objectiveLabel = (v: string | null) => OBJECTIVES.find((o) => o.value === v)?.label ?? "Sin objetivo";

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Campañas de WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enrola automáticamente a los leads que llegan y dales seguimiento con secuencias.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const res = await sync.mutateAsync();
                toast.success(`${res.synced} plantilla(s) sincronizada(s)`);
                if (res.errors?.length) toast.error(res.errors[0]);
              } catch (e: any) {
                toast.error(e?.message ?? "No se pudieron sincronizar las plantillas");
              }
            }}
            disabled={sync.isPending}
          >
            {sync.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar plantillas
          </Button>
          <Button variant="outline" onClick={() => setSegmentOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Envío segmentado
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nueva campaña
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando campañas…</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Megaphone className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Aún no tienes campañas</p>
            <p className="text-sm text-muted-foreground">
              Crea una para que cada lead nuevo reciba un primer mensaje automático por WhatsApp.
            </p>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Crear la primera
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{c.name}</p>
                    <Badge variant="secondary">{objectiveLabel(c.objective)}</Badge>
                    <Badge variant="outline">Prioridad {c.priority}</Badge>
                    {c.rule_mode === "prompt" && <Badge variant="outline">Regla con IA</Badge>}
                  </div>
                  {c.rule_prompt && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.rule_prompt}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: c.id, is_active: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setMetrics(c)} title="Métricas">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setDialogOpen(true); }} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" title="Eliminar"
                    onClick={() => {
                      if (confirm(`¿Eliminar la campaña "${c.name}"?`)) del.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} campaign={editing} />
      <CampaignMetricsDrawer campaign={metrics} onOpenChange={(v) => !v && setMetrics(null)} />
      <SegmentSendDialog open={segmentOpen} onOpenChange={setSegmentOpen} />
    </div>
  );
}
