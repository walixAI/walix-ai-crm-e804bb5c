import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ClipboardList, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { daysSince, formatMXN, type DealTaskRow, type PipelineDeal } from "@/lib/queries/pipeline";

interface Props {
  deal: PipelineDeal;
  contactName?: string;
  contactColor?: string | null;
  tasks?: DealTaskRow[];
  unread?: number;
  onOpen: (deal: PipelineDeal) => void;
  isOverlay?: boolean;
}

function probabilityColor(p: number): string {
  if (p >= 70) return "bg-success";
  if (p >= 40) return "bg-warning";
  return "bg-danger";
}

export function DealCard({ deal, contactName, contactColor, tasks, unread = 0, onOpen, isOverlay }: Props) {
  const navigate = useNavigate();
  const days = daysSince(deal.updatedAt);
  const pendingTask = (tasks ?? []).some(t => !t.completed);

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
      onClick={() => !isOverlay && onOpen(deal)}
      className={cn(
        "relative cursor-pointer rounded-xl bg-card border border-border p-3 shadow-sm transition-all overflow-hidden group",
        !isOverlay && "hover:shadow-md hover:border-primary/30",
        isOverlay && "shadow-glow rotate-1",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-semibold text-sm leading-tight line-clamp-2">{deal.name}</div>
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
        <span
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
            days > 10 ? "bg-danger/10 text-danger" : days > 5 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
          )}
        >
          {days}d en etapa
        </span>
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[9px] text-white" style={{ backgroundColor: deal.ownerColor }}>
            {deal.ownerInitials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Probability progress bar at the bottom */}
      <div className="absolute left-0 right-0 bottom-0 h-1 bg-muted/50">
        <div
          className={cn("h-full transition-all", probabilityColor(deal.probability))}
          style={{ width: `${deal.probability}%` }}
        />
      </div>
    </div>
  );
}
