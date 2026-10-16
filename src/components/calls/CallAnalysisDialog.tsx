import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { LogFollowUpDialog } from "@/components/activity/LogFollowUpDialog";

interface Props { call: any | null; onClose: () => void }

/** Análisis IA de una llamada: resumen, perfil, resultado/tipificación sugeridos; el asesor confirma. */
export default function CallAnalysisDialog({ call, onClose }: Props) {
  const qc = useQueryClient();
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [followUp, setFollowUp] = useState(false);

  useEffect(() => { setTranscript(call?.transcript ?? ""); }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = call?.ai_suggestions ?? null;

  async function analyze() {
    if (transcript.trim().length < 20) return toast.error("La transcripción es muy corta");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("call-analyzer", { body: { callId: call.id, transcript } });
    setBusy(false);
    if (error || (data as any)?.error) {
      let msg = (data as any)?.error;
      try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* noop */ }
      return toast.error(msg ?? "No se pudo analizar la llamada");
    }
    toast.success("Llamada analizada");
    await qc.invalidateQueries({ queryKey: ["calls"] });
    qc.invalidateQueries({ queryKey: ["contact"] });
    onClose();
  }

  return (
    <>
      <Dialog open={!!call && !followUp} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Análisis de la llamada</DialogTitle>
            <DialogDescription>{call?.contacts?.name ?? call?.to_number}</DialogDescription>
          </DialogHeader>

          {call?.ai_summary ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-medium mb-1">Resumen</p>
                <p className="text-muted-foreground">{call.ai_summary}</p>
              </div>
              {s?.next_step && <p><span className="font-medium">Siguiente paso: </span>{s.next_step}</p>}
              <div className="flex flex-wrap gap-2">
                {s?.sentiment && <Badge variant="outline">Ánimo: {s.sentiment}</Badge>}
                {s?.outcome_label && <Badge variant="secondary">Resultado sugerido: {s.outcome_label}</Badge>}
                {s?.typification_label && <Badge variant="secondary">Tipificación: {s.typification_label}</Badge>}
              </div>
              {s?.profile && Object.keys(s.profile).length > 0 && (
                <div>
                  <p className="font-medium mb-1">Datos detectados para el perfilamiento</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {Object.entries(s.profile).map(([k, v]) => (
                      <li key={k}>
                        {k}: <span className="text-foreground">{String(v)}</span>
                        {s.profile_applied?.includes(k) ? " · guardado" : " · ya tenía dato, no se cambió"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {call.contact_id && (
                <Button className="w-full" onClick={() => setFollowUp(true)}>
                  <ClipboardCheck className="h-4 w-4 mr-2" />Confirmar y registrar seguimiento
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cuando el proveedor entregue la transcripción, la IA la analizará sola. También puedes pegarla aquí.
            </p>
          )}

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">Transcripción</p>
            <Textarea rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)}
              placeholder="Asesor: Hola… / Lead: Me interesa…" />
            <Button variant="outline" className="w-full" disabled={busy} onClick={analyze}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {call?.ai_summary ? "Volver a analizar" : "Analizar con IA"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {call?.contact_id && (
        <LogFollowUpDialog
          open={followUp}
          onOpenChange={(v) => { setFollowUp(v); if (!v) onClose(); }}
          contactId={call.contact_id}
          dealId={call.deal_id ?? null}
          allowDealPicker={!call.deal_id}
          initialDescription={call.ai_summary ?? ""}
          initialOutcomeId={s?.outcome_id ?? null}
        />
      )}
    </>
  );
}
