import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WBadge } from "@/components/walix/Badge";
import { CheckCircle2, Plus, Trash2, MessageCircle, Users, Lock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useWhatsappChannels, useDisconnectChannel, type ChannelKind, type WhatsappChannel } from "@/lib/queries/whatsappChannels";
import { ConnectChannelDialog } from "./ConnectChannelDialog";
import { ByoWabaWizard } from "./ByoWabaWizard";
import { EmbeddedSignupButton } from "./EmbeddedSignupButton";
import { TeamAccessTable } from "./TeamAccessTable";
import { LiveTestDialog } from "./LiveTestDialog";
import { WebhookDiagnosticsPanel } from "./WebhookDiagnosticsPanel";
import { relativeTime } from "@/lib/format/relativeTime";

export function WhatsappSettingsTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isTenantAdmin } = usePermissions();
  const { data: channels = [] } = useWhatsappChannels(tenantId);
  const disconnect = useDisconnectChannel(tenantId);
  const [dialogKind, setDialogKind] = useState<ChannelKind | null>(null);
  const [wizardKind, setWizardKind] = useState<ChannelKind | null>(null);
  const [testChannel, setTestChannel] = useState<WhatsappChannel | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["wa-templates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, name, content, category, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  async function handleAddTemplate() {
    if (!newName.trim() || !newContent.trim()) return;
    const { error } = await supabase.from("message_templates").insert({
      tenant_id: tenantId, name: newName.trim(), content: newContent.trim(),
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setNewName(""); setNewContent("");
    qc.invalidateQueries({ queryKey: ["wa-templates", tenantId] });
    toast({ title: "Plantilla creada" });
  }

  async function handleDeleteTemplate(id: string) {
    await supabase.from("message_templates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["wa-templates", tenantId] });
  }

  const clientsCh = channels.find((c) => c.kind === "clients");
  const teamCh = channels.find((c) => c.kind === "team");

  function renderChannelCard(kind: ChannelKind, ch: WhatsappChannel | undefined) {
    const title = kind === "clients" ? "Canal Clientes" : "Canal Equipo (Walix Bot)";
    const desc = kind === "clients"
      ? "Recibe y responde conversaciones con leads."
      : "Tu equipo envía comandos a la IA y opera el CRM por WhatsApp.";
    const icon = kind === "clients" ? <MessageCircle className="h-6 w-6 text-success" /> : <Users className="h-6 w-6 text-primary" />;

    return (
      <Card key={kind} className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`h-12 w-12 rounded-2xl grid place-items-center ${kind === "clients" ? "bg-success/10" : "bg-primary/10"}`}>{icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">{title}</h3>
                {ch?.status === "connected" && ch.connected_at && <WBadge variant="success"><CheckCircle2 className="h-3 w-3" /> Conectado</WBadge>}
                {ch?.status === "connected" && !ch.connected_at && <WBadge variant="info">Configurado</WBadge>}
                {ch?.status === "pending" && <WBadge variant="warning">Pendiente verificación</WBadge>}
                {ch?.status === "error" && <WBadge variant="danger">Error</WBadge>}
                {!ch && <WBadge variant="neutral">Desconectado</WBadge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
              {ch && ch.status === "pending" && (
                <p className="text-xs text-muted-foreground mt-1">Pulsa "Reconfigurar" → "Marcar como conectado" para validar contra Meta.</p>
              )}
              {ch?.phone_number && <p className="text-xs text-muted-foreground mt-1 font-mono">{ch.phone_number}</p>}
              {ch?.last_inbound_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Último mensaje recibido: {relativeTime(ch.last_inbound_at)}
                  {ch.last_inbound_from && <> desde <span className="font-mono">+{ch.last_inbound_from}</span></>}
                </p>
              )}
              {ch?.last_error && <p className="text-xs text-destructive mt-1">{ch.last_error}</p>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {ch && isTenantAdmin && (
              <Button variant="outline" size="sm" onClick={() => setTestChannel(ch)}>
                Probar en vivo
              </Button>
            )}
            {ch && ch.status !== "disabled" && (
              <Button variant="outline" size="sm" onClick={async () => { await disconnect.mutateAsync(ch.id); toast({ title: "Canal desconectado" }); }}>
                Desconectar
              </Button>
            )}
            {isTenantAdmin && (
              <Button size="sm" onClick={() => setWizardKind(kind)}>
                {ch ? "Reconectar" : "Conectar WhatsApp"}
              </Button>
            )}
            {isTenantAdmin && (
              <EmbeddedSignupButton
                tenantId={tenantId}
                kind={kind}
                isReconnect={!!ch}
                size="sm"
                variant="outline"
              />
            )}
            {isTenantAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setDialogKind(kind)} title="Modo avanzado: pega Phone Number ID + WABA ID + token manualmente">
                Modo avanzado
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!isTenantAdmin && (
        <Card className="p-4 flex items-center gap-3 bg-warning/5 border-warning/30">
          <Lock className="h-5 w-5 text-warning" />
          <p className="text-sm">Solo administradores y propietarios pueden gestionar la conexión de WhatsApp.</p>
        </Card>
      )}

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Conexiones WhatsApp Business</h2>
          <p className="text-sm text-muted-foreground">Dos canales independientes vía Meta Cloud API.</p>
        </div>
        {renderChannelCard("clients", clientsCh)}
        {renderChannelCard("team", teamCh)}
      </div>

      {isTenantAdmin && teamCh && (
        <TeamAccessTable tenantId={tenantId} />
      )}
      {isTenantAdmin && (clientsCh || teamCh) && (
        <WebhookDiagnosticsPanel tenantId={tenantId} />
      )}
      {isTenantAdmin && !teamCh && (
        <Card className="p-4 flex items-center gap-3 bg-muted/30">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Conecta el canal "Equipo" para autorizar a tus vendedores.</p>
        </Card>
      )}

      {/* Plantillas */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Plantillas rápidas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mensajes reutilizables disponibles desde el chat.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-start">
          <Input placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Textarea
            placeholder="Hola {{nombre}}, te confirmo tu cita..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
          />
          <Button onClick={handleAddTemplate}>
            <Plus className="h-4 w-4 mr-2" /> Crear
          </Button>
        </div>

        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <div className="flex-1">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.content}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin plantillas todavía.</p>
          )}
        </div>
      </Card>

      {/* Horario */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Horario de atención</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Fuera de este horario, los mensajes recibirán una respuesta automática.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 max-w-md">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="time" defaultValue="09:00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="time" defaultValue="18:00" />
          </div>
        </div>
      </Card>

      {dialogKind && (
        <ConnectChannelDialog
          open
          onClose={() => setDialogKind(null)}
          tenantId={tenantId}
          kind={dialogKind}
          existing={dialogKind === "clients" ? clientsCh : teamCh}
        />
      )}

      {wizardKind && (
        <ByoWabaWizard
          open
          onClose={() => setWizardKind(null)}
          tenantId={tenantId}
          kind={wizardKind}
        />
      )}

      {testChannel && (
        <LiveTestDialog
          open
          onClose={() => { setTestChannel(null); qc.invalidateQueries({ queryKey: ["wa-channels", tenantId] }); }}
          channelId={testChannel.id}
          channelPhone={testChannel.phone_number}
        />
      )}
    </div>
  );
}