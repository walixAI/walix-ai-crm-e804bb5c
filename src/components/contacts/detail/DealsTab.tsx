import { useMemo, useState } from "react";
import { Bot, History, KanbanSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DealDrawer } from "@/components/pipeline/DealDrawer";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { StageStepper } from "./StageStepper";
import { probabilityLabel, effectiveProbability } from "@/lib/pipeline/probability";
import { DueBadge } from "./DueBadge";
import {
  formatMXN, usePipelines, useStages, useContactPipelineDeals, useContactStageHistory,
  type PipelineDeal, type PipelineStage,
} from "@/lib/queries/pipeline";
import { cn } from "@/lib/utils";


interface Props { contactId: string; contactName?: string }

export function useContactStageMaps() {
  const { data: stages = [] } = useStages();
  const { data: pipelines = [] } = usePipelines();
  return useMemo(() => {
    const byId = new Map<string, PipelineStage>(stages.map((s) => [s.id, s]));
    const byPipeline = new Map<string, PipelineStage[]>();
    for (const s of stages) {
      const key = s.pipelineId ?? "none";
      if (!byPipeline.has(key)) byPipeline.set(key, []);
      byPipeline.get(key)!.push(s);
    }
    for (const list of byPipeline.values()) list.sort((a, b) => a.position - b.position);
    const pipelineName = new Map(pipelines.map((p) => [p.id, p.name]));
    return {
      stagesFor(deal: PipelineDeal): PipelineStage[] {
        const stage = deal.stageId ? byId.get(deal.stageId) : undefined;
        const key = stage?.pipelineId ?? "none";
        return byPipeline.get(key) ?? [];
      },
      pipelineNameFor(deal: PipelineDeal): string | null {
        const stage = deal.stageId ? byId.get(deal.stageId) : undefined;
        return stage?.pipelineId ? pipelineName.get(stage.pipelineId) ?? null : null;
      },
      allStages: stages,
    };
  }, [stages, pipelines]);
}

export function DealsTab({ contactId, contactName }: Props) {
  const { data: deals = [] } = useContactPipelineDeals(contactId);
  const { data: history = [] } = useContactStageHistory(contactId);
  const maps = useContactStageMaps();
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<PipelineDeal | null>(null);

  const visible = showAll ? deals : deals.filter((d) => !d.isWon && !d.isLost);
  const closedCount = deals.filter((d) => d.isWon || d.isLost).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {visible.length} oportunidad{visible.length === 1 ? "" : "es"}
          {!showAll && closedCount > 0 && ` · ${closedCount} cerrada${closedCount === 1 ? "" : "s"} oculta${closedCount === 1 ? "" : "s"}`}
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          <Button size="sm" variant={showAll ? "ghost" : "secondary"} className="h-7 text-xs" onClick={() => setShowAll(false)}>Activas</Button>
          <Button size="sm" variant={showAll ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setShowAll(true)}>Todas</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
          <KanbanSquare className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Este contacto no tiene oportunidades {showAll ? "" : "activas"}.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((d) => {
            const stages = maps.stagesFor(d);
            const pipeline = maps.pipelineNameFor(d);
            const last = history.find((h) => h.dealId === d.id);
            return (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className="w-full text-left rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {pipeline ? `${pipeline} · ` : ""}
                      <span className={cn(d.isWon && "text-success", d.isLost && "text-destructive")}>{d.stageName}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gradient-brand leading-none">{formatMXN(d.amount)}</div>
                    <div className={cn("text-[10px] mt-1", d.isWon ? "text-success" : d.isLost ? "text-destructive" : "text-muted-foreground")}>
                      {probabilityLabel(d)}
                    </div>
                  </div>
                </div>

                {!d.isWon && !d.isLost && (
                  <div className="mt-2">
                    <DueBadge date={d.expectedCloseDate} />
                  </div>
                )}

                <div className="mt-3">
                  <StageStepper stages={stages} currentStageId={d.stageId} isWon={d.isWon} isLost={d.isLost} stageName={d.stageName} />
                </div>

                <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground flex-wrap">
                  <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-muted">{d.ownerInitials}</AvatarFallback></Avatar>
                  <span>{d.ownerName}</span>
                  {last && (
                    <>
                      <span>·</span>
                      <History className="h-3 w-3" />
                      <span>
                        {last.fromStageName ? `${last.fromStageName} → ` : ""}{last.toStageName} · {format(new Date(last.changedAt), "d MMM HH:mm", { locale: es })}
                      </span>
                      {last.metadata?.automatic && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                          <Bot className="h-3 w-3" /> Auto
                        </span>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DealDrawer
        deal={selected}
        stages={selected ? maps.stagesFor(selected) : []}
        open={!!selected}
        onClose={() => setSelected(null)}
        contactName={contactName}
        defaultTab="history"
      />
    </div>
  );
}
