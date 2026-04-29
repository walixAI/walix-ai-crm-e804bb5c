import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WBadge } from "@/components/walix/Badge";
import { CheckCircle2, Plus, Trash2, RefreshCw, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMembers } from "@/lib/queries/team";

export function WhatsappSettingsTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: members = [] } = useMembers(tenantId);

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

  return (
    <div className="space-y-6">
      {/* Conexión */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-success/10 grid place-items-center">
              <MessageCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">WhatsApp Business</h2>
                <WBadge variant="success"><CheckCircle2 className="h-3 w-3" /> Conectado (demo)</WBadge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">+52 55 1234 5678</p>
              <p className="text-xs text-muted-foreground mt-2">
                La integración real con WhatsApp Business Cloud API se habilita cuando conectes tu cuenta.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled>
            <RefreshCw className="h-4 w-4 mr-2" /> Reconectar
          </Button>
        </div>
      </Card>

      {/* Agentes */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Agentes habilitados</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Selecciona quién puede atender conversaciones desde WhatsApp.
        </p>
        <div className="space-y-2">
          {members.filter((m) => m.is_active).map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="text-sm font-medium">{m.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay miembros activos.</p>
          )}
        </div>
      </Card>

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
    </div>
  );
}