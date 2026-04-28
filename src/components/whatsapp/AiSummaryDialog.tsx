import { useState } from "react";
import { Copy, FileText, StickyNote, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  summary: string | null;
  error: string | null;
  contactId: string | null;
  tenantId: string | null;
}

export function AiSummaryDialog({ open, onOpenChange, loading, summary, error, contactId, tenantId }: Props) {
  const [savingNote, setSavingNote] = useState(false);

  const copy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    toast({ title: "Copiado", description: "Resumen copiado al portapapeles." });
  };

  const addAsNote = async () => {
    if (!summary || !contactId || !tenantId) return;
    setSavingNote(true);
    const { error: e } = await supabase.from("activities").insert({
      tenant_id: tenantId,
      contact_id: contactId,
      type: "note",
      description: `Resumen IA de conversación:\n\n${summary}`,
      occurred_at: new Date().toISOString(),
    });
    setSavingNote(false);
    if (e) {
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nota agregada", description: "El resumen quedó en el contacto." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Resumen de conversación
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[160px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generando resumen…
            </div>
          )}
          {!loading && error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {error}
            </div>
          )}
          {!loading && !error && summary && (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={copy} disabled={!summary || loading}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar resumen
          </Button>
          <Button onClick={addAsNote} disabled={!summary || loading || savingNote || !contactId}>
            <StickyNote className="h-4 w-4 mr-2" />
            {savingNote ? "Guardando…" : "Agregar como nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}