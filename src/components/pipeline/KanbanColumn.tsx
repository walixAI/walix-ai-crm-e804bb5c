import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMXN, type DealTaskRow, type PipelineDeal, type PipelineStage } from "@/lib/queries/pipeline";
import { DealCard } from "./DealCard";

interface Props {
  stage: PipelineStage;
  deals: PipelineDeal[];
  contactName: (id: string | null) => string | undefined;
  contactColor: (id: string | null) => string | null | undefined;
  tasksByDeal: Map<string, DealTaskRow[]>;
  unreadByContact: Map<string, number>;
  onOpenDeal: (deal: PipelineDeal) => void;
  onAddDeal: (stage: PipelineStage) => void;
}

export function KanbanColumn({
  stage, deals, contactName, contactColor, tasksByDeal, unreadByContact, onOpenDeal, onAddDeal,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stage } });
  const total = deals.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-muted/30 rounded-xl border border-border">
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
            aria-label={`Añadir deal en ${stage.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="text-xs font-medium text-muted-foreground">{formatMXN(total)}</div>
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
            contactName={contactName(d.contactId)}
            contactColor={contactColor(d.contactId)}
            tasks={tasksByDeal.get(d.id)}
            unread={d.contactId ? unreadByContact.get(d.contactId) ?? 0 : 0}
            onOpen={onOpenDeal}
          />
        ))}
        {deals.length === 0 && (
          <div className="text-xs text-muted-foreground italic text-center py-6">Arrastra un deal aquí</div>
        )}
      </div>
    </div>
  );
}
