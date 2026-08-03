import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/queries/pipeline";

interface Props {
  stages: PipelineStage[];
  currentStageId: string | null;
  isWon?: boolean;
  isLost?: boolean;
  compact?: boolean;
}

export function StageStepper({ stages, currentStageId, isWon, isLost, compact }: Props) {
  if (stages.length === 0) return null;
  const idx = stages.findIndex((s) => s.id === currentStageId);
  const currentIdx = idx >= 0 ? idx : 0;
  const current = stages[currentIdx];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          {stages.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <Tooltip key={s.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      done && "bg-primary/50",
                      active && (isLost ? "bg-destructive" : isWon ? "bg-success" : "bg-gradient-brand"),
                      !done && !active && "bg-muted",
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{s.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {!compact && (
          <div className="text-[10px] text-muted-foreground">
            Etapa {currentIdx + 1} de {stages.length} · <span className="font-medium text-foreground">{current?.name}</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
