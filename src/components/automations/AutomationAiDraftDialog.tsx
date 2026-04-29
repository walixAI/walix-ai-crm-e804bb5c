import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { draftAutomationWithAi, type AutomationDraft } from "@/services/automations";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDraftReady: (draft: AutomationDraft) => void;
}

const EXAMPLES = [
  "Avísame cuando un cliente lleve 3 días sin contestarme un WhatsApp",
  "Cuando llegue un lead nuevo, asígnalo al vendedor con menos clientes",
  "Si un deal de más de $10,000 lleva 7 días sin movimiento, notifica al gerente",
];

export function AutomationAiDraftDialog({ open, onOpenChange, onDraftReady }: Props) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const d = await draftAutomationWithAi(prompt.trim());
      onDraftReady(d);
      onOpenChange(false);
      setPrompt("");
      toast({ title: "Borrador listo", description: "Revisa el flujo antes de activarlo." });
    } catch (e: any) {
      toast({ title: "No pudimos generar el borrador", description: e?.message ?? "Intenta reformular.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Crear con IA</DialogTitle>
          <DialogDescription>Describe en una frase lo que quieres automatizar. La IA armará el flujo y podrás editarlo antes de activarlo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ej: Cuando llegue un nuevo lead por WhatsApp, mándale el mensaje de bienvenida y asígnalo a Carlos." rows={4} className="bg-card" disabled={loading} />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Inspírate:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => setPrompt(ex)} disabled={loading} className="text-xs px-2 py-1 rounded-full border border-border bg-card hover:border-primary/40 transition">{ex}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={submit} disabled={loading || !prompt.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generar borrador
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
