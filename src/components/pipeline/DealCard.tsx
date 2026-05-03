import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ClipboardList, MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatMXN, type DealTaskRow, type PipelineDeal, type PipelineStage } from "@/lib/queries/pipeline";
import { computeDealHealth } from "@/lib/dealHealth";
import { HealthBadges } from "./HealthBadges";
import { QuickActions } from "./QuickActions";
import type { DealAiSuggestion } from "@/lib/queries/pipelineAi";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { scoreDeal } from "@/services/ai";

interface Props {
  deal: PipelineDeal;
  stages?: PipelineStage[];
  contactName?: string;
  contactColor?: string | null;
  contactLastActivityAt?: string | null;
  tasks?: DealTaskRow[];
  unread?: number;
  aiSuggestion?: DealAiSuggestion;
  onOpen: (deal: PipelineDeal) => void;
  selected?: boolean;
  onToggleSelect?: (dealId: string) => void;
  selectionActive?: boolean;
  onRequestLost?: (deal: PipelineDeal) => void;
  onNewTask?: (deal: PipelineDeal) => void;
  isOverlay?: boolean;
}

function probabilityColor(p: number): string {
  if (p >= 70) return "bg-success";
  if (p >= 40) return "bg-warning";
  return "bg-danger";
}

function DealCardImpl({
  deal, stages = [], contactName, contactColor, contactLastActivityAt, tasks, unread = 0, aiSuggestion,
  onOpen, selected, onToggleSelect, selectionActive, onRequestLost, onNewTask, isOverlay,
}: Props) {
  const navigate = useNavigate();
  const pendingTask = (tasks ?? []).some(t => !t.completed);
  const health = computeDealHealth(deal, contactLastActivityAt);

  // Tooltip explanation for the probability bar.
  // Reuses the shared `scoreDeal()` helper so the explanation phrasing
  // matches the model output ("Respondió en <2h, lleva X días en esta etapa").
  const daysInStage = Math.max(
    0,
    Math.round((Date.now() - new Date(deal.updatedAt).getTime()) / 86_400_000),
  );
  const daysSinceLastActivity = contactLastActivityAt
    ? Math.max(0, Math.round((Date.now() - new Date(contactLastActivityAt).getTime()) / 86_400_000))
    : daysInStage;
  const scoreExplain = scoreDeal({
    daysInStage,
    daysSinceLastActivity,
    openedProposalCount: 0,
    responseTimeHours: daysSinceLastActivity <= 1 ? 1 : 24,
  });

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging && !isOverlay ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (isOverlay) return;
        if (selectionActive && onToggleSelect) onToggleSelect(deal.id);
        else onOpen(deal);
      }}
      className={cn(
        "relative cursor-pointer rounded-xl bg-card border border-border p-3 shadow-sm transition-all overflow-hidden group",
        !isOverlay && "hover:shadow-md hover:border-primary/30",
        selected && "border-primary ring-2 ring-primary/30",
        isOverlay && "shadow-glow rotate-1",
      )}
    >
      {/* Selection checkbox */}
      {!isOverlay && onToggleSelect && (
        <div
          className={cn(
            "absolute top-2 left-2 z-10 transition-opacity",
            selected || selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={!!selected}
            onCheckedChange={() => onToggleSelect(deal.id)}
            className="bg-card shadow-sm"
            aria-label="Seleccionar oportunidad"
          />
        </div>
      )}

      {/* Quick actions (hidden during selection mode) */}
      {!isOverlay && !selectionActive && stages.length > 0 && onRequestLost && onNewTask && (
        <QuickActions deal={deal} stages={stages} onRequestLost={onRequestLost} onNewTask={onNewTask} />
      )}

      <div className="flex items-start justify-between gap-2 mb-1">
        <div className={cn("font-semibold text-sm leading-tight line-clamp-2", onToggleSelect && "pl-6")}>{deal.name}</div>
        <div className="flex items-center gap-1 shrink-0">
          {pendingTask && <ClipboardList className="h-3.5 w-3.5 text-warning" />}
          {unread > 0 && (
            <div className="relative">
              <MessageCircle className="h-3.5 w-3.5 text-success" />
              <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-success text-success-foreground rounded-full h-3 min-w-3 px-1 grid place-items-center font-bold">
                {unread}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="text-success font-bold text-base mb-2">{formatMXN(deal.amount)} MXN</div>

      {contactName && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (deal.contactId) navigate(`/contacts/${deal.contactId}`);
          }}
          className="inline-flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/70 rounded-full pl-0.5 pr-2 py-0.5 max-w-full"
        >
          <Avatar className="h-4 w-4">
            <AvatarFallback
              className="text-[8px] text-white"
              style={{ backgroundColor: contactColor ?? "hsl(220 13% 65%)" }}
            >
              {contactName.split(" ").map(p => p[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{contactName}</span>
        </button>
      )}

      <div className="flex items-center justify-between gap-2 mt-3">
        <HealthBadges health={health} />
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[9px] text-white" style={{ backgroundColor: deal.ownerColor }}>
            {deal.ownerInitials}
          </AvatarFallback>
        </Avatar>
      </div>

      {aiSuggestion && (
        <div
          className={cn(
            "mt-2 rounded-md border px-2 py-1.5 flex items-start gap-1.5",
            aiSuggestion.urgency === "high"
              ? "bg-danger/5 border-danger/30"
              : aiSuggestion.urgency === "medium"
                ? "bg-warning/5 border-warning/30"
                : "bg-primary/5 border-primary/20",
          )}
        >
          <Sparkles className={cn(
            "h-3 w-3 shrink-0 mt-0.5",
            aiSuggestion.urgency === "high" ? "text-danger"
              : aiSuggestion.urgency === "medium" ? "text-warning" : "text-primary",
          )} />
          <span className="text-[11px] leading-tight line-clamp-2 text-foreground/90">{aiSuggestion.text}</span>
        </div>
      )}

      {/* Probability progress bar at the bottom */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute left-0 right-0 bottom-0 h-1.5 bg-muted/50 cursor-help"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={cn("h-full transition-all", probabilityColor(deal.probability))}
                style={{ width: `${deal.probability}%` }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-xs">
            <div className="font-semibold mb-0.5">
              Probabilidad de cierre {deal.probability}%
            </div>
            <div className="text-muted-foreground leading-snug">{scoreExplain.reason}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export const DealCard = memo(DealCardImpl);
