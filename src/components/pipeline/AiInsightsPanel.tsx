import { useState } from "react";
import { AlertTriangle, Lightbulb, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { useAnalyzePipeline, type PipelineAnalysis } from "@/lib/queries/pipelineAi";
import type { PipelineDeal } from "@/lib/queries/pipeline";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  deals: PipelineDeal[];
  contactLastActivityById: Map<string, string | null>;
}

const sevToVariant = (s: "low" | "medium" | "high") =>
  s === "high" ? "danger" : s === "medium" ? "warning" : "info";

export function AiInsightsPanel({ open, onClose, deals, contactLastActivityById }: Props) {
  const [analysis, setAnalysis] = useState<PipelineAnalysis | null>(null);
  const analyze = useAnalyzePipeline();

  async function run() {
    if (deals.length === 0) {
      toast.error("No hay deals activos para analizar");
      return;
    }
    try {
      const result = await analyze.mutateAsync({ deals, contactLastActivityById });
      setAnalysis(result);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al analizar");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[460px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-brand grid place-items-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <SheetTitle>Insights IA</SheetTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Análisis de salud, riesgos y recomendaciones para tu pipeline activo.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!analysis && !analyze.isPending && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                Genera un análisis del pipeline con {deals.filter(d => !d.isWon && !d.isLost).length} deals activos.
              </p>
              <Button onClick={run} className="bg-primary hover:bg-primary/90">
                <Sparkles className="h-3.5 w-3.5" /> Analizar pipeline
              </Button>
            </div>
          )}

          {analyze.isPending && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="animate-pulse text-sm text-muted-foreground">Analizando pipeline…</div>
            </div>
          )}

          {analysis && (
            <>
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-4">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Salud del pipeline
                  </span>
                  <span className={cn(
                    "text-3xl font-bold",
                    analysis.health_score >= 70 ? "text-success"
                      : analysis.health_score >= 40 ? "text-warning" : "text-danger",
                  )}>{analysis.health_score}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div
                    className={cn(
                      "h-full transition-all",
                      analysis.health_score >= 70 ? "bg-success"
                        : analysis.health_score >= 40 ? "bg-warning" : "bg-danger",
                    )}
                    style={{ width: `${analysis.health_score}%` }}
                  />
                </div>
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
              </div>

              {analysis.risks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" /> Riesgos detectados
                  </div>
                  {analysis.risks.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm">{r.title}</span>
                        <WBadge variant={sevToVariant(r.severity)}>{r.severity}</WBadge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {analysis.recommendations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    <Lightbulb className="h-3.5 w-3.5" /> Recomendaciones
                  </div>
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm">{r.title}</span>
                        <WBadge variant={sevToVariant(r.impact)}>{r.impact}</WBadge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.action}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full" onClick={run} disabled={analyze.isPending}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-analizar
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}