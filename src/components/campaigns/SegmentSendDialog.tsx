import { useState } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CampaignRuleEditor } from "./CampaignRuleEditor";
import { useSegmentSend, useWaTemplates, type CampaignConditions } from "@/lib/queries/whatsappCampaigns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SegmentSendDialog({ open, onOpenChange }: Props) {
  const [conditions, setConditions] = useState<CampaignConditions>({});
  const [mode, setMode] = useState<"filters" | "prompt">("filters");
  const [prompt, setPrompt] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [text, setText] = useState("");
  const send = useSegmentSend();
  const { data: templates = [] } = useWaTemplates();
  const approved = templates.filter((t) => (t.status ?? "").toLowerCase() === "approved");

  const submit = async () => {
    if (!templateId && !text.trim()) return toast.error("Elige una plantilla o escribe un mensaje");
    try {
      const res = await send.mutateAsync({
        conditions,
        template_id: templateId || null,
        text,
      });
      toast.success(`Enviados ${res.sent ?? 0} de ${res.total} · ${res.failed ?? 0} con error`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Envío segmentado</DialogTitle>
          <DialogDescription>
            Manda un mensaje puntual a los contactos que cumplan los criterios. Fuera de la ventana de 24 h se usa la plantilla.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
          <div>
            <Label className="mb-2 block flex items-center gap-2"><Users className="h-4 w-4" /> Audiencia</Label>
            <CampaignRuleEditor
              mode={mode} onModeChange={setMode}
              conditions={conditions} onConditionsChange={setConditions}
              prompt={prompt} onPromptChange={setPrompt}
              unresolved={unresolved} onUnresolvedChange={setUnresolved}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Plantilla aprobada (para quienes están fuera de 24 h)</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Sin plantilla" /></SelectTrigger>
              <SelectContent>
                {approved.length === 0 && <SelectItem value="none" disabled>Sin plantillas sincronizadas</SelectItem>}
                {approved.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.language})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Mensaje libre (dentro de 24 h)</Label>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hola {{nombre}}, tenemos una promoción para ti." />
          </div>
        </div>

        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
