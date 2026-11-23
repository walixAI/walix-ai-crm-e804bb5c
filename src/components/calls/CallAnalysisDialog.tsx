import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ClipboardCheck, Pencil, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { LogFollowUpDialog } from "@/components/activity/LogFollowUpDialog";
import { CallTranscript } from "./CallTranscript";
import { isRecordingDownloadable } from "../../../supabase/functions/_shared/call-recording";
import { CallRecordingButton } from "./CallRecordingButton";
import { CallHangupDetails } from "./CallHangupDetails";

interface Props { call: any | null; onClose: () => void }

/** Análisis IA de una llamada: resumen, perfil, resultado/tipificación sugeridos; el asesor confirma. */
export default function CallAnalysisDialog({ call, onClose }: Props) {
  const qc = useQueryClient();
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => { setEditing(false); setTranscript(call?.transcript ?? ""); }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!editing) setTranscript(call?.transcript ?? ""); }, [call?.transcript, editing]);

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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-lg p-0 gap-0">
          <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 pr-12 text-left">
            <DialogTitle className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10"><Sparkles className="h-5 w-5 text-primary" /></span>Análisis de la llamada</DialogTitle>
            <DialogDescription>{call?.contacts?.name ?? call?.to_number}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-6">
          {call && (call.ended_at || ["completed", "failed", "no_answer", "busy", "voicemail"].includes(call.status)) && <CallHangupDetails hangup_by={call.hangup_by} hangup_at={call.hangup_at} userId={(call as any).user_id} />}
          {call?.id && isRecordingDownloadable(call) && <CallRecordingButton key={call.id} callId={call.id} withPlayer />}
          <CallTranscript status={s?.transcription_status} transcript={call?.transcript} summary={call?.ai_summary} analyzing={busy} />
          {call?.ai_summary ? (
            <div className="space-y-3 text-sm">
              {s?.next_step && <div className="border-y border-border py-3"><p className="mb-1 flex items-center gap-2 font-medium"><ArrowRight className="h-4 w-4 text-primary" />Siguiente paso</p><p className="break-words text-muted-foreground leading-relaxed">{s.next_step}</p></div>}
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
          ) : null}

          {s?.transcription_status !== "processing" && <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Transcripción</p><Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}{editing ? "Cancelar" : call?.transcript ? "Editar" : "Agregar texto"}</Button></div>
            {editing && <Textarea rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} aria-label="Editar transcripción"
              placeholder="Asesor: Hola… / Contacto: Me interesa…" className="resize-y leading-relaxed" />}
            <Button variant="outline" className="w-full" disabled={busy || transcript.trim().length < 20} onClick={analyze}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {call?.ai_summary ? "Volver a analizar" : "Analizar con IA"}
            </Button>
          </div>}
          </div>
        </DialogContent>
      </Dialog>
      {call?.contact_id && (
        <LogFollowUpDialog
          open={followUp}
          onOpenChange={(v) => { setFollowUp(v); if (!v) onClose(); }}
          contactId={call.contact_id}
          callId={call.id}
          dealId={call.deal_id ?? null}
          allowDealPicker
          initialDescription={call.ai_summary ?? ""}
          initialOutcomeId={s?.outcome_id ?? null}
        />
      )}
    </>
  );
}
