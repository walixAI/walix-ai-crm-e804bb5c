import { CheckCheck, FileText, Sparkles, TriangleAlert } from "lucide-react";

interface Props {
  status?: string;
  transcript?: string;
  summary?: string;
  analyzing?: boolean;
}

/** Shared presentation driven by actual provider transcription state. */
export function CallTranscript({ status, transcript, summary, analyzing = false }: Props) {
  const processing = status === "processing" || analyzing;
  if (processing) return (
    <div className="call-ai-processing rounded-lg border border-border p-5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span>
        <div className="call-ai-wave flex h-10 items-center gap-1" aria-hidden="true">
          {Array.from({ length: 15 }, (_, i) => <span key={i} className="h-8 w-1 rounded-full bg-primary" />)}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold">{analyzing ? "La IA está analizando la conversación" : "La IA está transcribiendo tu llamada"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{analyzing ? "Preparando el resumen y los siguientes pasos…" : "Procesando la grabación…"}</p>
      <div className="call-ai-track mt-4 h-1 overflow-hidden rounded-full bg-primary/10" aria-hidden="true"><span className="block h-full w-1/3 rounded-full bg-primary" /></div>
    </div>
  );
  if (status === "failed" && !transcript) return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-border p-4">
      <TriangleAlert className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div><p className="text-sm font-medium">Transcripción no disponible</p><p className="mt-1 text-xs text-muted-foreground">La grabación se conservó.</p></div>
    </div>
  );
  if (!transcript && !summary && status !== "completed") return null;
  return (
    <section className="call-ai-result space-y-4" aria-label="Resultado de la transcripción">
      <div className="flex items-center gap-2 text-xs font-medium"><CheckCheck className="h-4 w-4 text-primary" />{transcript || status === "completed" ? "Transcripción lista" : "Análisis listo"}</div>
      {summary && <div className="border-l-2 border-primary pl-3"><p className="mb-1 flex items-center gap-2 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5" />Resumen de la llamada</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{summary}</p></div>}
      {transcript && <details className="call-transcript-details rounded-lg border border-border bg-muted/30" open={!summary}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium"><FileText className="mr-2 inline h-4 w-4 align-text-bottom" />Conversación completa</summary>
        <div className="max-h-64 space-y-3 overflow-y-auto border-t border-border px-4 py-4 text-sm leading-relaxed">
          {transcript.split(/\n+/).filter((line) => line.trim()).map((line, i) => <p key={i} className="whitespace-pre-wrap break-words">{line}</p>)}
        </div>
      </details>}
    </section>
  );
}