import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntityContext, useProactiveSuggestions, useAiMemoryLogger } from "@/hooks/useAiMemory";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/services/aiMemory";

interface Props {
  entityType: Extract<EntityType, "contact" | "deal">;
  entityId: string;
}

function urgencyColor(score: number) {
  if (score >= 70) return "bg-destructive";
  if (score >= 30) return "bg-warning";
  return "bg-success";
}

function sentimentEmoji(s: string) {
  switch (s) {
    case "positive": return "😊";
    case "negative": return "😟";
    case "neutral": return "😐";
    default: return "🤔";
  }
}

export function AiContextPanel({ entityType, entityId }: Props) {
  const qc = useQueryClient();
  const { data: ctx, isLoading } = useEntityContext(entityType, entityId);
  const { data: suggestions = [] } = useProactiveSuggestions();
  const logEvent = useAiMemoryLogger();

  const nextStep = suggestions.find(
    (s) => s.entity_type === entityType && s.entity_id === entityId,
  );

  async function refresh() {
    await logEvent(entityType, entityId, "manual_refresh", {});
    qc.invalidateQueries({ queryKey: ["ai-entity-context", entityType, entityId] });
    toast.success("Recalculando contexto…");
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden shadow-card">
      <div className="px-4 py-2.5 border-b border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Memoria IA
        </div>
        <button
          onClick={refresh}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Actualizar contexto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {!ctx ? (
        <div className="px-4 py-4 text-xs text-muted-foreground italic">
          {isLoading ? "Cargando contexto…" : "Aún no hay contexto suficiente — la IA aprende con cada interacción."}
        </div>
      ) : (
        <div className="px-4 py-3 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              Lo que sé <span>{sentimentEmoji(ctx.sentiment)}</span>
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {ctx.context_summary || "Sin resumen aún."}
            </p>
            {Array.isArray(ctx.key_facts) && ctx.key_facts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ctx.key_facts.slice(0, 5).map((f: any, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-border text-foreground"
                  >
                    {typeof f === "string" ? f : JSON.stringify(f)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center justify-between">
              <span>Urgencia</span>
              <span className="font-semibold text-foreground">{ctx.urgency_score}/100</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full transition-all", urgencyColor(ctx.urgency_score))}
                style={{ width: `${ctx.urgency_score}%` }}
              />
            </div>
          </div>

          {nextStep && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Siguiente paso sugerido
              </div>
              <p className="text-xs text-foreground leading-relaxed">{nextStep.suggestion_text}</p>
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={refresh} className="w-full text-xs h-7 gap-1">
            <RefreshCw className="h-3 w-3" /> Actualizar contexto
          </Button>
        </div>
      )}
    </div>
  );
}