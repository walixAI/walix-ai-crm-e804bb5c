import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle, Phone, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  RadioGroup, RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  useToggleContactTask, useCreateContactActivity,
} from "@/lib/queries/contacts";

type Method = "whatsapp" | "call" | "other";
type CallResult = "answered" | "no_answer" | "voicemail";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string;
  task: { id: string; title: string } | null;
}

export function CloseTaskDialog({ open, onOpenChange, contactId, task }: Props) {
  const [method, setMethod] = useState<Method>("call");
  const [note, setNote] = useState("");
  const [callResult, setCallResult] = useState<CallResult>("answered");
  const navigate = useNavigate();
  const toggle = useToggleContactTask(contactId);
  const createActivity = useCreateContactActivity(contactId);

  function reset() {
    setMethod("call"); setNote(""); setCallResult("answered");
  }

  async function submit() {
    if (!task) return;
    try {
      if (method === "whatsapp") {
        // Register intent + jump to WhatsApp; mark task done immediately so the
        // gestor no longer sees it in Mi Día.
        await createActivity.mutateAsync({
          type: "note",
          description: `WhatsApp enviado — ${task.title}${note ? `\n${note}` : ""}`,
        });
        await toggle.mutateAsync({ id: task.id, completed: true });
        toast.success("Tarea cerrada. Abriendo WhatsApp…");
        onOpenChange(false); reset();
        navigate(`/whatsapp?contactId=${contactId}`);
        return;
      }
      if (method === "call") {
        const resultLabel =
          callResult === "answered" ? "Contestó" :
          callResult === "no_answer" ? "No contestó" : "Buzón de voz";
        await createActivity.mutateAsync({
          type: "call",
          description: `${resultLabel} — ${task.title}${note ? `\n${note}` : ""}`,
          metadata: { call_result: callResult, task_id: task.id },
        });
      } else {
        await createActivity.mutateAsync({
          type: "note",
          description: `${task.title}${note ? `\n${note}` : ""}`,
          metadata: { task_id: task.id },
        });
      }
      await toggle.mutateAsync({ id: task.id, completed: true });
      toast.success("Tarea marcada como hecha");
      onOpenChange(false); reset();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cerrar la tarea");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">¿Cómo la resolviste?</DialogTitle>
        </DialogHeader>
        {task && (
          <p className="text-sm text-muted-foreground -mt-2">{task.title}</p>
        )}

        <RadioGroup
          value={method}
          onValueChange={(v) => setMethod(v as Method)}
          className="grid grid-cols-3 gap-3 pt-2"
        >
          <MethodTile value="call" label="Llamada" icon={<Phone className="h-6 w-6" />} active={method==="call"} />
          <MethodTile value="whatsapp" label="WhatsApp" icon={<MessageCircle className="h-6 w-6" />} active={method==="whatsapp"} />
          <MethodTile value="other" label="Otro" icon={<CheckCircle2 className="h-6 w-6" />} active={method==="other"} />
        </RadioGroup>

        {method === "call" && (
          <div className="space-y-2 pt-2">
            <Label>Resultado</Label>
            <RadioGroup value={callResult} onValueChange={(v) => setCallResult(v as CallResult)} className="grid grid-cols-3 gap-2">
              {[
                { v: "answered", l: "Contestó" },
                { v: "no_answer", l: "No contestó" },
                { v: "voicemail", l: "Buzón" },
              ].map((o) => (
                <label key={o.v}
                  className={`text-sm border rounded-lg px-3 py-2 text-center cursor-pointer ${callResult===o.v ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}>
                  <RadioGroupItem value={o.v} className="sr-only" />
                  {o.l}
                </label>
              ))}
            </RadioGroup>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <Label>{method === "whatsapp" ? "Nota opcional" : "Detalles"}</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              method === "call" ? "¿Qué te dijo? ¿Próximo paso?" :
              method === "whatsapp" ? "¿Qué le vas a preguntar?" :
              "Describe brevemente qué pasó"
            }
            rows={3}
            className="text-base"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="lg" onClick={submit} disabled={toggle.isPending || createActivity.isPending}>
            {method === "whatsapp" ? "Abrir WhatsApp" : "Marcar como hecha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MethodTile({ value, label, icon, active }: { value: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
      <RadioGroupItem value={value} className="sr-only" />
      <div className={active ? "text-primary" : "text-muted-foreground"}>{icon}</div>
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );
}