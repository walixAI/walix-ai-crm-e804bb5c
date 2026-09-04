import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMXN, type DealTaskRow, type PipelineDeal, type PipelineStage } from "@/lib/queries/pipeline";
import { DealCard } from "./DealCard";
import type { DealAiSuggestion } from "@/lib/queries/pipelineAi";
import type { PipelineLens } from "@/lib/usePipelinePrefs";

interface Props {
  stage: PipelineStage;
  allStages: PipelineStage[];
  deals: PipelineDeal[];
  lens: PipelineLens;
  contactName: (id: string | null) => string | undefined;
  contactColor: (id: string | null) => string | null | undefined;
  contactLastActivityAt: (id: string | null) => string | null | undefined;
  tasksByDeal: Map<string, DealTaskRow[]>;
  unreadByContact: Map<string, number>;
  aiSuggestionsByDeal: Map<string, DealAiSuggestion>;
  onOpenDeal: (deal: PipelineDeal) => void;
  onAddDeal: (stage: PipelineStage) => void;
  selectedIds: Set<string>;
  onToggleSelect: (dealId: string) => void;
  selectionActive: boolean;
  onRequestLost: (deal: PipelineDeal) => void;
  onNewTask: (deal: PipelineDeal) => void;
  wipLimit?: number;
}

export function KanbanColumn({
  stage, allStages, deals, contactName, contactColor, contactLastActivityAt, tasksByDeal, unreadByContact, aiSuggestionsByDeal,
  onOpenDeal, onAddDeal, selectedIds, onToggleSelect, selectionActive, onRequestLost, onNewTask, wipLimit = 10,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stage } });
  const total = deals.reduce((s, d) => s + d.amount, 0);
  const isActive = !stage.isWon && !stage.isLost;
  const overWip = isActive && deals.length > wipLimit;

  return (
    <div
      className={cn(
        "flex flex-col w-[85vw] max-w-[320px] md:w-[280px] shrink-0 bg-muted/30 rounded-xl border border-border",
        overWip && "border-t-2 border-t-warning",
      )}
    >
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
          <span className="text-sm font-semibold flex-1 truncate">{stage.name}</span>
          <span className="text-xs font-bold bg-background border border-border rounded-full px-1.5 py-0.5 min-w-[1.5rem] text-center">
            {deals.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onAddDeal(stage)}
            aria-label={`Añadir oportunidad en ${stage.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-muted-foreground">{formatMXN(total)}</div>
          {overWip && (
            <span className="text-[10px] font-semibold text-warning bg-warning/10 border border-warning/30 rounded-full px-1.5 py-0.5 leading-none">
              Cuello de botella
            </span>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px] transition-colors",
          isOver && "bg-primary/5 ring-1 ring-primary/30 ring-inset",
        )}
      >
        {deals.map(d => (
          <DealCard
            key={d.id}
            deal={d}
            stages={allStages}
            contactName={contactName(d.contactId)}
            contactColor={contactColor(d.contactId)}
            contactLastActivityAt={contactLastActivityAt(d.contactId)}
            tasks={tasksByDeal.get(d.id)}
            unread={d.contactId ? unreadByContact.get(d.contactId) ?? 0 : 0}
            aiSuggestion={aiSuggestionsByDeal.get(d.id)}
            onOpen={onOpenDeal}
            selected={selectedIds.has(d.id)}
            onToggleSelect={onToggleSelect}
            selectionActive={selectionActive}
            onRequestLost={onRequestLost}
            onNewTask={onNewTask}
          />
        ))}
        {deals.length === 0 && (
          <div className="text-xs text-muted-foreground italic text-center py-6">Arrastra un deal aquí</div>
        )}
      </div>
    </div>
  );
}
